import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large — maximum 10 MB' }, { status: 400 });
  }

  // Extract raw text from PDF
  let rawText: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    // pdf-parse ships both CJS and ESM; the callable may sit on .default or on the module itself
    const pdfParseModule = (await import('pdf-parse')) as any;
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> = pdfParseModule.default ?? pdfParseModule;
    const parsed = await pdfParse(buffer);
    rawText = parsed.text?.trim() ?? '';
  } catch (err) {
    console.error('[extract-pdf] pdf-parse error:', err);
    return NextResponse.json({ error: 'Could not read PDF — ensure it is not password-protected or scanned-only' }, { status: 422 });
  }

  if (rawText.length < 50) {
    return NextResponse.json({ error: 'PDF appears to be a scanned image with no extractable text. Please use a text-based PDF.' }, { status: 422 });
  }

  // Use Claude Haiku to extract structured invention fields
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are a patent analyst. Extract invention details from this document text and return them as JSON.

DOCUMENT TEXT:
${rawText.slice(0, 8000)}

Return ONLY a JSON object with this exact structure:
{
  "title": "invention title (max 150 chars)",
  "technicalField": "technical field or domain (max 150 chars)",
  "description": "detailed description of how it works, components, mechanism (max 2000 chars)",
  "problemSolved": "the problem or limitation this invention addresses (max 500 chars)",
  "keyInnovations": ["innovation 1", "innovation 2", "innovation 3"]
}

Rules:
- keyInnovations: 3–8 specific novel technical features, each under 200 chars
- If a field cannot be determined from the text, make a reasonable inference
- Write in English regardless of source language
- description must be technical and detailed`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('');

    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extracted = JSON.parse(clean);

    return NextResponse.json({
      title: String(extracted.title ?? '').slice(0, 200),
      technicalField: String(extracted.technicalField ?? '').slice(0, 200),
      description: String(extracted.description ?? '').slice(0, 5000),
      problemSolved: String(extracted.problemSolved ?? '').slice(0, 2000),
      keyInnovations: Array.isArray(extracted.keyInnovations)
        ? extracted.keyInnovations.slice(0, 8).map((k: unknown) => String(k).slice(0, 200))
        : [],
    });
  } catch (err) {
    console.error('[extract-pdf] Claude extraction error:', err);
    return NextResponse.json({ error: 'Failed to extract invention details from PDF' }, { status: 500 });
  }
}

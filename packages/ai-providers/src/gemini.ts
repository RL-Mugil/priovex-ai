import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import type {
  AIAnalysisInput,
  AIAnalysisOutput,
  PatentSummaryInput,
  ComparisonInput,
  ComparisonOutput,
  ConceptExtraction,
  KeywordStrategy,
  ScoredPatent,
} from '@priovex/types';
import type { AIProvider } from './interface';
import { withRetry } from './interface';
import {
  SYSTEM_PROMPT_PATENT_EXPERT,
  buildConceptExtractionPrompt,
  buildKeywordStrategyPrompt,
  buildPatentComparisonPrompt,
  buildFullReportPrompt,
} from './prompts';

const GEMINI_MODEL = 'gemini-2.0-flash-exp';

export class GeminiProvider implements AIProvider {
  readonly name = 'Google Gemini';
  readonly model = GEMINI_MODEL;

  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private async chat(userMessage: string): Promise<{ text: string; tokens: number }> {
    return withRetry(async () => {
      const model = this.genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: SYSTEM_PROMPT_PATENT_EXPERT,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
          temperature: 0.3,
        },
      });

      const result = await model.generateContent(userMessage);
      const text = result.response.text();
      const tokens = result.response.usageMetadata?.totalTokenCount ?? 0;
      return { text, tokens };
    }, undefined, 'Gemini chat');
  }

  private parseJSON<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as T;
      throw new Error('Failed to parse Gemini JSON response');
    }
  }

  async extractConcepts(
    inventionTitle: string,
    inventionDescription: string,
    technicalField: string,
    keyInnovations: string[]
  ): Promise<ConceptExtraction> {
    const prompt = buildConceptExtractionPrompt(
      inventionTitle, inventionDescription, technicalField, keyInnovations
    );
    const { text } = await this.chat(prompt);
    return this.parseJSON<ConceptExtraction>(text);
  }

  async buildKeywordStrategy(
    concepts: ConceptExtraction,
    technicalField: string
  ): Promise<KeywordStrategy> {
    const prompt = buildKeywordStrategyPrompt(JSON.stringify(concepts), technicalField);
    const { text } = await this.chat(prompt);
    return this.parseJSON<KeywordStrategy>(text);
  }

  async compareInventionToPatent(input: ComparisonInput): Promise<ComparisonOutput> {
    const prompt = buildPatentComparisonPrompt(
      input.inventionDescription,
      input.patent.title,
      input.patent.abstract,
      input.patent.claims
    );
    const { text } = await this.chat(prompt);
    return this.parseJSON<ComparisonOutput>(text);
  }

  async summarizePatent(input: PatentSummaryInput): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(
      `Summarize in 2-3 sentences:\nTitle: ${input.title}\nAbstract: ${input.abstract}`
    );
    return result.response.text().trim();
  }

  async generateFullReport(input: AIAnalysisInput): Promise<AIAnalysisOutput> {
    const scoredPatents: ScoredPatent[] = [];
    let totalTokens = 0;

    const batchSize = 5;
    const candidates = input.candidatePatents.slice(0, 20);

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((p) =>
          this.compareInventionToPatent({
            inventionDescription: `${input.inventionTitle}: ${input.inventionDescription}`,
            patent: {
              publicationNumber: p.publicationNumber,
              title: p.title,
              abstract: p.abstract,
              claims: p.claims,
            },
          })
        )
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          const patent = batch[idx];
          scoredPatents.push({
            ...patent,
            ...result.value,
            rank: scoredPatents.length + 1,
          });
        }
      });
    }

    scoredPatents.sort((a, b) => b.similarityScore - a.similarityScore);
    scoredPatents.forEach((p, idx) => { p.rank = idx + 1; });

    const topPatentsStr = scoredPatents.slice(0, 10).map((p, i) =>
      `${i + 1}. ${p.publicationNumber} — "${p.title}" (${p.similarityScore}% similar)`
    ).join('\n');

    const reportPrompt = buildFullReportPrompt(
      input.inventionTitle,
      input.inventionDescription,
      'Technology',
      [],
      topPatentsStr,
      input.reportStyle
    );

    const { text, tokens } = await this.chat(reportPrompt);
    totalTokens += tokens;

    const reportData = this.parseJSON<{
      executiveSummary: string;
      patentabilityAssessment: AIAnalysisOutput['patentabilityAssessment'];
      claimStrategy: AIAnalysisOutput['claimStrategy'];
    }>(text);

    const costUsd = (totalTokens / 1_000_000) * 0.15; // Gemini Flash pricing

    return {
      executiveSummary: reportData.executiveSummary,
      scoredPatents,
      patentabilityAssessment: reportData.patentabilityAssessment,
      claimStrategy: reportData.claimStrategy,
      tokensUsed: totalTokens,
      costUsd,
      model: GEMINI_MODEL,
      provider: 'gemini',
    };
  }
}

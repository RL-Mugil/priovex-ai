import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'priovex-reports';

export async function uploadReport(
  searchId: string,
  filename: string,
  content: Buffer,
  contentType: string
): Promise<string> {
  const path = `reports/${searchId}/${filename}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, content, {
    contentType,
    upsert: true,
  });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function getSignedUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) throw new Error(`Failed to generate signed URL: ${error?.message}`);
  return data.signedUrl;
}

export async function deleteReport(searchId: string): Promise<void> {
  const { data: files } = await supabase.storage
    .from(BUCKET)
    .list(`reports/${searchId}`);

  if (files?.length) {
    const paths = files.map((f) => `reports/${searchId}/${f.name}`);
    await supabase.storage.from(BUCKET).remove(paths);
  }
}

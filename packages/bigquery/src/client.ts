import { BigQuery } from '@google-cloud/bigquery';

let _client: BigQuery | null = null;

export function getBigQueryClient(): BigQuery {
  if (_client) return _client;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT is not set');

  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    : undefined;

  _client = new BigQuery({
    projectId,
    credentials,
    location: process.env.BIGQUERY_LOCATION ?? 'US',
  });

  return _client;
}

export const PATENTS_TABLE = 'patents-public-data.patents.publications';
export const MAX_BYTES_BILLED = parseInt(
  process.env.BIGQUERY_MAX_BYTES_BILLED ?? '10000000000'
);

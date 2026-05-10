// EPO Open Patent Services — claims retrieval + patent search (BigQuery fallback)
// Rate limit: 4 req/sec burst (we send 1 per 300ms = 3.3/sec, safe margin)
// Token TTL: 20 minutes (we refresh 60s early to avoid mid-batch expiry)

import type { RawPatent } from '@priovex/types';

const EPO_OPS_BASE = 'https://ops.epo.org/3.2/rest-services';
const EPO_OPS_AUTH = 'https://ops.epo.org/3.2/auth/accesstoken';
const INTER_REQUEST_MS = 300;  // ~3.3 req/sec — stays under 4/sec limit
const TIMEOUT_MS = 12_000;
const SEARCH_TIMEOUT_MS = 20_000;

interface TokenCache {
  token: string;
  expiresAt: number;
}

let _tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 60_000) {
    return _tokenCache.token;
  }

  const key    = process.env.EPO_OPS_KEY;
  const secret = process.env.EPO_OPS_SECRET;

  if (!key || !secret) {
    throw new Error('EPO_OPS_KEY and EPO_OPS_SECRET environment variables not set');
  }

  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(EPO_OPS_AUTH, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`EPO OPS auth failed: HTTP ${res.status}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    _tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
    return _tokenCache.token;
  } finally {
    clearTimeout(timer);
  }
}

// BigQuery publication_number format: "EP-2345678-A1" or "WO-2019-123456-A1"
// EPO OPS epodoc format: "EP2345678A1" or "WO2019123456A1" (strip dashes)
function toEpodoc(publicationNumber: string): string {
  return publicationNumber.replace(/-/g, '');
}

function parseClaimsXML(xml: string): string {
  const claims: string[] = [];
  const claimRegex = /<claim\b[^>]*>([\s\S]*?)<\/claim>/gi;
  let match: RegExpExecArray | null;

  while ((match = claimRegex.exec(xml)) !== null && claims.length < 5) {
    const text = match[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 20) claims.push(text);
  }

  return claims.join('\n\n');
}

async function fetchClaimsForOne(publicationNumber: string, token: string): Promise<string | null> {
  const epodoc = toEpodoc(publicationNumber);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `${EPO_OPS_BASE}/published-data/publication/epodoc/${epodoc}/claims`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/xml, text/xml',
        },
        signal: controller.signal,
      }
    );

    if (res.status === 404) return null;
    if (res.status === 403) return null;
    if (!res.ok) return null;

    const xml = await res.text();
    const claims = parseClaimsXML(xml);
    return claims.length > 0 ? claims : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchEPOClaimsBatch(
  publicationNumbers: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  if (!process.env.EPO_OPS_KEY || !process.env.EPO_OPS_SECRET) {
    return results;
  }

  let token: string;
  try {
    token = await getAccessToken();
  } catch (err) {
    console.warn('[EPO OPS] Auth failed:', (err as Error).message);
    return results;
  }

  for (let i = 0; i < publicationNumbers.length; i++) {
    const num = publicationNumbers[i];
    const claims = await fetchClaimsForOne(num, token);
    if (claims) results.set(num, claims);

    if (i < publicationNumbers.length - 1) {
      await new Promise((r) => setTimeout(r, INTER_REQUEST_MS));
    }
  }

  return results;
}

// =============================================================================
// EPO OPS PATENT SEARCH — used as BigQuery fallback when quota is exceeded
// =============================================================================

function parseEPODate(d: string): string {
  return d.length === 8
    ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
    : d;
}

function parseEPOSearchXML(xml: string): { patents: RawPatent[]; total: number } {
  const patents: RawPatent[] = [];
  const seen = new Set<string>();

  const totalM = xml.match(/total-result-count="(\d+)"/i);
  const total  = totalM ? parseInt(totalM[1], 10) : 0;

  const docRegex = /<exchange-document\b([^>]*)>([\s\S]*?)<\/exchange-document>/gi;
  let docM: RegExpExecArray | null;

  while ((docM = docRegex.exec(xml)) !== null) {
    const attrs   = docM[1];
    const content = docM[2];

    const countryM = attrs.match(/\bcountry="([^"]+)"/);
    const docNumM  = attrs.match(/\bdoc-number="([^"]+)"/);
    const kindM    = attrs.match(/\bkind="([^"]+)"/);
    const familyM  = attrs.match(/\bfamily-id="([^"]+)"/);

    if (!countryM || !docNumM) continue;

    const country  = countryM[1].toUpperCase();
    const docNum   = docNumM[1].replace(/\s/g, '');
    const kind     = kindM?.[1] ?? '';
    const pubNum   = kind ? `${country}-${docNum}-${kind}` : `${country}-${docNum}`;

    if (seen.has(pubNum)) continue;
    seen.add(pubNum);

    // Title — prefer English
    const titleM =
      content.match(/<invention-title[^>]*lang="en"[^>]*>([\s\S]*?)<\/invention-title>/i) ??
      content.match(/<invention-title[^>]*>([\s\S]*?)<\/invention-title>/i);
    const title = titleM
      ? titleM[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      : '';
    if (!title) continue;

    // Abstract — prefer English
    const abstractM =
      content.match(/<abstract[^>]*lang="en"[^>]*>([\s\S]*?)<\/abstract>/i) ??
      content.match(/<abstract[^>]*>([\s\S]*?)<\/abstract>/i);
    const abstract = abstractM
      ? abstractM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    // Filing date from application-reference
    const appDateM = content.match(/<application-reference[\s\S]*?<date>(\d{8})<\/date>/i);
    const filingDate = appDateM ? parseEPODate(appDateM[1]) : '';

    // Publication date
    const pubDateM = content.match(/<publication-reference[\s\S]*?<date>(\d{8})<\/date>/i);
    const grantDate = pubDateM ? parseEPODate(pubDateM[1]) : undefined;

    // Assignees
    const assignees: string[] = [];
    const applicantRe = /<applicant\b[^>]*>([\s\S]*?)<\/applicant>/gi;
    let aM: RegExpExecArray | null;
    while ((aM = applicantRe.exec(content)) !== null) {
      const nM = aM[1].match(/<name>([\s\S]*?)<\/name>/i);
      if (nM) assignees.push(nM[1].replace(/<[^>]+>/g, '').trim());
    }

    // Inventors
    const inventors: string[] = [];
    const inventorRe = /<inventor\b[^>]*>([\s\S]*?)<\/inventor>/gi;
    let iM: RegExpExecArray | null;
    while ((iM = inventorRe.exec(content)) !== null) {
      const nM = iM[1].match(/<name>([\s\S]*?)<\/name>/i);
      if (nM) inventors.push(nM[1].replace(/<[^>]+>/g, '').trim());
    }

    // CPC codes — extract from IPC text elements (format: "G 06 Q  20/ 00  ...")
    const cpcCodes: string[] = [];
    const classTextRe = /<text>\s*([A-H])\s*(\d{2})\s*([A-Z])\s*(\d+)\/\s*(\d+)/gi;
    let cM: RegExpExecArray | null;
    while ((cM = classTextRe.exec(content)) !== null) {
      const code = `${cM[1]}${cM[2]}${cM[3]}${cM[4]}/${cM[5]}`;
      if (!cpcCodes.includes(code)) cpcCodes.push(code);
    }

    patents.push({
      publicationNumber: pubNum,
      title,
      abstract,
      filingDate: filingDate || grantDate || '',
      grantDate,
      assignees,
      inventors,
      cpcCodes,
      ipcCodes: [],
      countryCode: country,
      familyId: familyM?.[1],
      url: `https://patents.google.com/patent/${pubNum.replace(/-/g, '')}`,
    });
  }

  return { patents, total };
}

async function runEPOSearch(
  query: string,
  token: string,
  maxResults: number,
): Promise<{ patents: RawPatent[]; total: number }> {
  const rangeEnd = Math.min(maxResults, 100);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const url = `${EPO_OPS_BASE}/published-data/search/biblio?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/xml, text/xml',
        'X-OPS-Range': `1-${rangeEnd}`,
      },
      signal: controller.signal,
    });

    if (res.status === 404) return { patents: [], total: 0 };

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`EPO OPS search HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const xml = await res.text();
    return parseEPOSearchXML(xml);
  } finally {
    clearTimeout(timer);
  }
}

export async function searchEPOByKeywords(
  keywords: string[],
  maxResults = 100,
): Promise<{ patents: RawPatent[]; total: number }> {
  if (!process.env.EPO_OPS_KEY || !process.env.EPO_OPS_SECRET) {
    throw new Error('EPO OPS credentials not configured');
  }

  const token = await getAccessToken();

  // CQL: title/abstract contains any of the top keywords
  const terms = keywords
    .slice(0, 8)
    .map(k => `ta all "${k.replace(/['"]/g, '')}"`)
    .join(' OR ');

  return runEPOSearch(`(${terms})`, token, maxResults);
}

export async function searchEPOByCPC(
  cpcCodes: string[],
  maxResults = 100,
): Promise<{ patents: RawPatent[]; total: number }> {
  if (!process.env.EPO_OPS_KEY || !process.env.EPO_OPS_SECRET) {
    throw new Error('EPO OPS credentials not configured');
  }

  const token = await getAccessToken();

  // CQL: match any of the top CPC codes
  const terms = cpcCodes
    .slice(0, 5)
    .map(c => `cpc any "${c}"`)
    .join(' OR ');

  return runEPOSearch(`(${terms})`, token, maxResults);
}

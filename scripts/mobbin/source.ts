import type { Database } from './db';

export type Platform = 'ios' | 'android' | 'web';
export type SourceApp = Record<string, any> & { id: string; appName?: string };

type SourceSession = {
  cookie: string;
  access_token: string | null;
  refresh_token: string | null;
};

const SEARCH_URL = 'https://mobbin.com/api/search-bar/fetch-searchable-apps';

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 5): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(60_000),
      });
      if (response.status !== 429 && response.status < 500) return response;
      const retryAfter = Number(response.headers.get('retry-after'));
      await response.body?.cancel();
      await sleep(Number.isFinite(retryAfter) ? retryAfter * 1_000 : 1_000 * 2 ** attempt);
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
      await sleep(1_000 * 2 ** attempt);
    }
  }
  throw lastError || new Error(`Request failed: ${url}`);
}

function authCookie(token: unknown, projectRef: string): string {
  const encoded = Buffer.from(JSON.stringify(token)).toString('base64url');
  const value = `base64-${encoded}`;
  const prefix = `sb-${projectRef}-auth-token`;
  const chunkSize = 3_500;
  if (value.length <= chunkSize) return `${prefix}=${value}`;

  const chunks: string[] = [];
  for (let offset = 0, index = 0; offset < value.length; offset += chunkSize, index++) {
    chunks.push(`${prefix}.${index}=${value.slice(offset, offset + chunkSize)}`);
  }
  return chunks.join('; ');
}

async function seedSession(sql: Database): Promise<void> {
  const cookie = process.env.MOBBIN_COOKIE;
  if (!cookie) return;
  await sql`
    INSERT INTO source_sessions (source, cookie, access_token, refresh_token)
    VALUES ('mobbin', ${cookie}, ${process.env.MOBBIN_ACCESS_TOKEN || null}, ${process.env.MOBBIN_REFRESH_TOKEN || null})
    ON CONFLICT (source) DO NOTHING
  `;
}

async function readSession(sql: Database): Promise<SourceSession> {
  await seedSession(sql);
  const [session] = await sql<SourceSession[]>`
    SELECT cookie, access_token, refresh_token
    FROM source_sessions
    WHERE source = 'mobbin'
  `;
  if (!session?.cookie) throw new Error('MOBBIN_COOKIE is required for the first run');
  return session;
}

function isUnauthenticated(response: Response, body: unknown): boolean {
  return response.status === 401 || response.status === 403 ||
    (body as any)?.error?.message === 'unauthenticated';
}

async function refreshSession(sql: Database, attemptedCookie: string): Promise<SourceSession> {
  return sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext('mobbin-session-refresh'))`;
    const [current] = await transaction<SourceSession[]>`
      SELECT cookie, access_token, refresh_token
      FROM source_sessions
      WHERE source = 'mobbin'
      FOR UPDATE
    `;

    if (current.cookie !== attemptedCookie) return current;
    if (!current.access_token || !current.refresh_token) {
      throw new Error('Mobbin session expired and refresh credentials are missing');
    }

    const projectRef = process.env.MOBBIN_SUPABASE_PROJECT_REF;
    const anonKey = process.env.MOBBIN_SUPABASE_ANON_KEY;
    if (!projectRef || !anonKey) {
      throw new Error('Mobbin session expired; Supabase project ref and anon key are required');
    }

    const response = await fetchWithRetry(
      `https://${projectRef}.supabase.co/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: anonKey,
          authorization: `Bearer ${current.access_token}`,
        },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      },
    );
    const token = await response.json();
    if (!response.ok || !token?.access_token || !token?.refresh_token) {
      throw new Error(`Unable to refresh Mobbin session (${response.status})`);
    }

    const cookie = authCookie(token, projectRef);
    await transaction`
      UPDATE source_sessions
      SET cookie = ${cookie}, access_token = ${token.access_token},
          refresh_token = ${token.refresh_token}, updated_at = now()
      WHERE source = 'mobbin'
    `;
    return { cookie, access_token: token.access_token, refresh_token: token.refresh_token };
  });
}

async function authenticatedRequest(
  sql: Database,
  url: string,
  init: RequestInit,
): Promise<{ response: Response; body: string }> {
  let session = await readSession(sql);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetchWithRetry(url, {
      ...init,
      headers: {
        accept: 'text/html,application/json',
        'user-agent': 'open-mobbin-archiver/1.0 (GitHub Actions)',
        ...init.headers,
        cookie: session.cookie,
      },
    });
    const body = await response.text();
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { parsed = null; }

    if (!isUnauthenticated(response, parsed)) {
      if (!response.ok) throw new Error(`Mobbin responded with ${response.status} for ${url}`);
      return { response, body };
    }
    session = await refreshSession(sql, session.cookie);
  }
  throw new Error('Mobbin authentication failed after refresh');
}

export async function fetchApps(sql: Database, platform: Platform): Promise<SourceApp[]> {
  const { body } = await authenticatedRequest(sql, SEARCH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ platform }),
  });
  const data = JSON.parse(body);
  if (!Array.isArray(data?.value)) throw new Error('Mobbin app index had an unexpected shape');
  return data.value.filter((app: any) => typeof app?.id === 'string');
}

function extractFlightData(html: string): string {
  let flightData = '';
  for (const chunk of html.matchAll(/<script[^>]*>self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g)) {
    try {
      const parsed = JSON.parse(chunk[1]);
      if (typeof parsed[1] === 'string') flightData += parsed[1];
    } catch {
      // Unrelated scripts are ignored.
    }
  }
  return flightData;
}

function extractJsonArrays(flightData: string, marker: string): any[][] {
  const arrays: any[][] = [];
  const needle = `"${marker}":`;
  let searchFrom = 0;
  while (searchFrom < flightData.length) {
    const markerIndex = flightData.indexOf(needle, searchFrom);
    if (markerIndex < 0) break;
    const start = flightData.indexOf('[', markerIndex + needle.length);
    if (start < 0) break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let index = start; index < flightData.length; index++) {
      const character = flightData[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
      } else if (character === '"') inString = true;
      else if (character === '[') depth++;
      else if (character === ']' && --depth === 0) {
        end = index;
        break;
      }
    }
    if (end < 0) break;
    try {
      const parsed = JSON.parse(flightData.slice(start, end + 1));
      if (Array.isArray(parsed)) arrays.push(parsed);
    } catch {
      // Continue to the next field occurrence.
    }
    searchFrom = markerIndex + needle.length;
  }
  return arrays;
}

export async function fetchAppDetails(
  sql: Database,
  platform: Platform,
  appId: string,
): Promise<{ screens: any[]; flows: any[]; sourceUrl: string }> {
  const sourceUrl = `https://mobbin.com/apps/app-${platform}-${appId}/_/flows`;
  const { body } = await authenticatedRequest(sql, sourceUrl, { method: 'GET' });
  const flightData = extractFlightData(body);
  const screens = extractJsonArrays(flightData, 'screens')
    .filter((candidate) => candidate.some((screen) => screen?.id && screen?.screenUrl))
    .sort((left, right) => right.length - left.length)[0];
  const flowScore = (items: any[]) => items.reduce(
    (total, flow) => total + (Array.isArray(flow?.screens) ? flow.screens.length : 0),
    0,
  );
  const flows = extractJsonArrays(flightData, 'partialFlows')
    .filter((candidate) => candidate.some((flow) => flow?.id && flow?.name))
    .sort((left, right) => flowScore(right) - flowScore(left) || right.length - left.length)[0];

  if (!screens || !flows) throw new Error('Mobbin page did not contain complete screen and flow data');
  return { screens, flows, sourceUrl };
}


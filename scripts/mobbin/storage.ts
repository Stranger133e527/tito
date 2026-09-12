import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { Database } from './db';

export type MediaKind = 'logo' | 'screen' | 'video';
export type StoredMedia = { id: string; uploaded: boolean };

let client: S3Client | undefined;

function storageConfig() {
  const accessKeyId = process.env.TIGRIS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.TIGRIS_SECRET_ACCESS_KEY;
  const bucket = process.env.TIGRIS_BUCKET;
  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('TIGRIS_ACCESS_KEY_ID, TIGRIS_SECRET_ACCESS_KEY, and TIGRIS_BUCKET are required');
  }
  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: process.env.TIGRIS_ENDPOINT || 'https://fly.storage.tigris.dev',
    region: process.env.TIGRIS_REGION || 'auto',
  };
}

function storageClient(): S3Client {
  if (client) return client;
  const config = storageConfig();
  client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return client;
}

function extensionFor(url: string, contentType: string): string {
  const knownTypes: Record<string, string> = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };
  if (knownTypes[contentType]) return knownTypes[contentType];
  try {
    const match = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
    if (match) return match[1].toLowerCase();
  } catch {
    // Fall through to a binary extension.
  }
  return 'bin';
}

export async function storeMedia(
  sql: Database,
  sourceUrl: string,
  kind: MediaKind,
): Promise<StoredMedia> {
  const id = createHash('sha256').update(sourceUrl).digest('hex');
  const [existing] = await sql<{ status: string }[]>`
    SELECT status FROM media_assets WHERE id = ${id}
  `;
  if (existing?.status === 'ready') return { id, uploaded: false };

  await sql`
    INSERT INTO media_assets (id, kind, source_url, status)
    VALUES (${id}, ${kind}, ${sourceUrl}, 'pending')
    ON CONFLICT (id) DO UPDATE
    SET kind = EXCLUDED.kind, status = 'pending', error = NULL, updated_at = now()
  `;

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        accept: kind === 'video' ? 'video/*' : 'image/*',
        referer: 'https://mobbin.com/',
        'user-agent': 'open-mobbin-archiver/1.0 (GitHub Actions)',
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok || !response.body) {
      throw new Error(`Media download returned ${response.status}`);
    }

    const contentType = (response.headers.get('content-type') || 'application/octet-stream')
      .split(';')[0]
      .trim();
    const objectKey = `mobbin/${kind}/${id.slice(0, 2)}/${id}.${extensionFor(sourceUrl, contentType)}`;
    const contentHash = createHash('sha256');
    let byteSize = 0;
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        byteSize += buffer.length;
        contentHash.update(buffer);
        callback(null, buffer);
      },
    });
    const body = Readable.fromWeb(response.body as any).pipe(meter);
    const config = storageConfig();
    const upload = new Upload({
      client: storageClient(),
      params: {
        Bucket: config.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: { source: 'mobbin', source_url_sha256: id },
      },
      queueSize: 4,
      partSize: 8 * 1024 * 1024,
      leavePartsOnError: false,
    });
    const result = await upload.done();
    await sql`
      UPDATE media_assets
      SET bucket = ${config.bucket}, object_key = ${objectKey}, content_type = ${contentType},
          byte_size = ${byteSize}, content_sha256 = ${contentHash.digest('hex')},
          etag = ${result.ETag || null}, status = 'ready', error = NULL, updated_at = now()
      WHERE id = ${id}
    `;
    return { id, uploaded: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql`
      UPDATE media_assets SET status = 'failed', error = ${message.slice(0, 2_000)}, updated_at = now()
      WHERE id = ${id}
    `;
    throw error;
  }
}

export async function markRestrictedMedia(
  sql: Database,
  sourceUrl: string,
  kind: MediaKind,
): Promise<string> {
  const id = createHash('sha256').update(sourceUrl).digest('hex');
  await sql`
    INSERT INTO media_assets (id, kind, source_url, status)
    VALUES (${id}, ${kind}, ${sourceUrl}, 'restricted')
    ON CONFLICT (id) DO UPDATE SET status = 'restricted', updated_at = now()
  `;
  return id;
}


import postgres, { type Sql } from 'postgres';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export type Database = Sql<Record<string, unknown>>;

export function connectDatabase(): Database {
  const databaseUrl = process.env.SCRAPER_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('SCRAPER_DATABASE_URL is required');

  return postgres(databaseUrl, {
    max: Number(process.env.DB_POOL_SIZE || 5),
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
  });
}

export async function migrate(sql: Database): Promise<void> {
  const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
  await sql.unsafe(await readFile(schemaPath, 'utf8'));
}


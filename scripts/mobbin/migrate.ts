import { connectDatabase, migrate } from './db';

const sql = connectDatabase();

try {
  await migrate(sql);
  console.log('Mobbin scraper schema is ready.');
} finally {
  await sql.end();
}


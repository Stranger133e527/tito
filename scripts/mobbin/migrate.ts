import { connectDatabase, migrate } from './db';

async function main() {
  const sql = connectDatabase();
  try {
    await migrate(sql);
    console.log('Mobbin scraper schema is ready.');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

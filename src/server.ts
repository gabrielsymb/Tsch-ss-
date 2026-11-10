import { Pool } from "pg";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { PostgresEntryRepository } from "./repositories/postgres-entry-repository.js";

const config = loadConfig();
const pool = new Pool({
  connectionString: config.databaseUrl,
  ...(config.databaseSsl ? { ssl: { rejectUnauthorized: true } } : {}),
});

const app = await buildApp({
  repository: new PostgresEntryRepository(pool),
  checkDatabase: async () => {
    await pool.query("SELECT 1");
  },
});

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exitCode = 1;
}

const shutdown = async () => {
  await app.close();
  await pool.end();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

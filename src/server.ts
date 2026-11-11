import { Pool } from "pg";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { PostgresDiscoveryRepository } from "./repositories/postgres-discovery-repository.js";
import { PostgresEntryRepository } from "./repositories/postgres-entry-repository.js";
import { DiscoveryService } from "./services/discovery-service.js";
import { startDiscoveryScheduler } from "./services/discovery-worker.js";

const config = loadConfig();
const pool = new Pool({
  connectionString: config.databaseUrl,
  ...(config.databaseSsl ? { ssl: { rejectUnauthorized: true } } : {}),
});
const discoveryRepository = new PostgresDiscoveryRepository(pool);

const app = await buildApp({
  repository: new PostgresEntryRepository(pool),
  discoveryService: new DiscoveryService(discoveryRepository),
  checkDatabase: async () => {
    await pool.query("SELECT 1");
  },
});

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  await pool.end();
  throw error;
}

const stopDiscoveryScheduler = startDiscoveryScheduler(discoveryRepository, {
  ...(process.env.GEMINI_API_KEY?.trim()
    ? { geminiApiKey: process.env.GEMINI_API_KEY.trim() }
    : {}),
  ...(process.env.OPENALEX_API_KEY?.trim()
    ? { openAlexApiKey: process.env.OPENALEX_API_KEY.trim() }
    : {}),
  log: (level, message) => app.log[level](message),
});

const shutdown = async () => {
  stopDiscoveryScheduler();
  await app.close();
  await pool.end();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

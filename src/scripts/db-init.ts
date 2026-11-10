import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { loadConfig } from "../config.js";
import { applyMigrations } from "./migrations.js";

const config = loadConfig();
const pool = new Pool({
  connectionString: config.databaseUrl,
  ...(config.databaseSsl ? { ssl: { rejectUnauthorized: true } } : {}),
});

try {
  const seed = await readFile(resolve("database/seed.sql"), "utf8");
  const client = await pool.connect();

  try {
    const appliedMigrations = await applyMigrations(
      client,
      resolve("database/migrations"),
    );
    await client.query("BEGIN");
    try {
      await client.query(seed);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    console.info(
      appliedMigrations
        ? `${appliedMigrations} migração(ões) e catálogo inicial aplicados.`
        : "Banco atualizado; catálogo inicial conferido.",
    );
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}

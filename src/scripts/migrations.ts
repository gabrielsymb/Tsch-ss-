import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { PoolClient } from "pg";

interface Migration {
  version: number;
  name: string;
  checksum: string;
  sql: string;
}

interface AppliedMigration {
  version: string;
  name: string;
  checksum: string;
}

export async function applyMigrations(
  client: PoolClient,
  migrationsDirectory: string,
): Promise<number> {
  const migrations = await loadMigrations(migrationsDirectory);

  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(27042026, 1)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version BIGINT PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const appliedResult = await client.query<AppliedMigration>(
      "SELECT version::text, name, checksum FROM schema_migrations ORDER BY version",
    );
    const appliedByVersion = new Map(
      appliedResult.rows.map((migration) => [Number(migration.version), migration]),
    );

    for (const applied of appliedResult.rows) {
      const local = migrations.find((migration) => migration.version === Number(applied.version));
      if (!local) {
        throw new Error(
          `A migração aplicada ${applied.version} (${applied.name}) não existe no diretório local.`,
        );
      }
      if (local.name !== applied.name || local.checksum !== applied.checksum) {
        throw new Error(
          `A migração aplicada ${applied.version} foi alterada. Crie uma nova migração em vez de editar uma já aplicada.`,
        );
      }
    }

    let appliedCount = 0;
    for (const migration of migrations) {
      if (appliedByVersion.has(migration.version)) {
        continue;
      }

      await client.query(migration.sql);
      await client.query(
        `INSERT INTO schema_migrations (version, name, checksum)
         VALUES ($1, $2, $3)`,
        [migration.version, migration.name, migration.checksum],
      );
      appliedCount += 1;
    }

    await client.query("COMMIT");
    return appliedCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function loadMigrations(directory: string): Promise<Migration[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name);
  const migrations: Migration[] = [];
  const versions = new Set<number>();

  for (const name of filenames) {
    const match = /^(\d{3,})_[a-z0-9_]+\.sql$/.exec(name);
    if (!match) {
      throw new Error(`Nome de migração inválido: ${name}. Use NNN_nome.sql.`);
    }

    const version = Number(match[1]);
    if (!Number.isSafeInteger(version) || version < 1 || versions.has(version)) {
      throw new Error(`Versão de migração inválida ou duplicada: ${name}.`);
    }
    versions.add(version);

    const sql = await readFile(join(directory, name), "utf8");
    migrations.push({
      version,
      name,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }

  migrations.sort((left, right) => left.version - right.version);
  return migrations;
}

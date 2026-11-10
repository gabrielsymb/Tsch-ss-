import "dotenv/config";

export interface Config {
  host: string;
  port: number;
  databaseUrl: string;
  databaseSsl: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT deve ser um número entre 1 e 65535.");
  }

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL é obrigatória.");
  }

  return {
    host: env.HOST ?? "0.0.0.0",
    port,
    databaseUrl,
    databaseSsl: env.DATABASE_SSL === "true",
  };
}

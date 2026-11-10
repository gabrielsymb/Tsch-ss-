import "dotenv/config";
import { buildApp } from "./app.js";
import { DemoEntryRepository } from "./repositories/demo-entry-repository.js";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT deve ser um número entre 1 e 65535.");
}

const app = await buildApp({ repository: new DemoEntryRepository() });

try {
  await app.listen({ host: "127.0.0.1", port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}

process.once("SIGINT", () => app.close());
process.once("SIGTERM", () => app.close());

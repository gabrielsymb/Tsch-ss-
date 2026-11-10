import Fastify, { type FastifyInstance } from "fastify";
import type { EntryRepository } from "./domain/entry.js";
import { registerEntryRoutes } from "./routes/entries.js";
import { EntryService } from "./services/entry-service.js";

export interface AppDependencies {
  repository: EntryRepository;
  checkDatabase?: () => Promise<void>;
  logger?: boolean;
}

export async function buildApp({
  repository,
  checkDatabase,
  logger = true,
}: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({ logger });
  const service = new EntryService(repository);

  app.get("/health", async (_request, reply) => {
    if (checkDatabase) {
      await checkDatabase();
      return reply.send({ status: "ok", database: "connected" });
    }
    return reply.send({ status: "ok", database: "not-configured" });
  });

  await registerEntryRoutes(app, service);
  return app;
}

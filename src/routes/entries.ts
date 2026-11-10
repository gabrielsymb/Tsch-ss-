import type { FastifyInstance } from "fastify";
import type { EntryService, EntrySearchInput } from "../services/entry-service.js";
import { InvalidQueryError } from "../services/entry-service.js";

interface EntryParams {
  slug: string;
}

export async function registerEntryRoutes(
  app: FastifyInstance,
  service: EntryService,
): Promise<void> {
  app.get<{ Querystring: EntrySearchInput }>("/api/v1/entries", async (request, reply) => {
    try {
      const page = await service.search(request.query);
      return {
        data: page.items,
        pagination: {
          limit: page.limit,
          offset: page.offset,
          total: page.total,
        },
      };
    } catch (error) {
      if (error instanceof InvalidQueryError) {
        return reply.code(400).send({ error: "invalid_query", message: error.message });
      }
      throw error;
    }
  });

  app.get<{ Params: EntryParams }>("/api/v1/entries/:slug", async (request, reply) => {
    const entry = await service.findBySlug(request.params.slug);
    if (!entry) {
      return reply.code(404).send({ error: "not_found", message: "Fórmula não encontrada." });
    }
    return { data: entry };
  });

  app.get("/api/v1/categories", async () => ({
    data: await service.listCategories(),
  }));
}

import type { FastifyInstance } from "fastify";
import {
  DiscoveryService,
  InvalidDiscoveryQueryError,
  type DiscoverySearchInput,
} from "../services/discovery-service.js";

export async function registerDiscoveryRoutes(
  app: FastifyInstance,
  service?: DiscoveryService,
): Promise<void> {
  app.get<{ Querystring: DiscoverySearchInput }>("/api/v1/discoveries", async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    if (!service) {
      return { data: [], pagination: { limit: 4, offset: 0, total: 0 } };
    }
    try {
      const page = await service.list(request.query);
      return {
        data: page.items,
        pagination: {
          limit: page.limit,
          offset: page.offset,
          total: page.total,
        },
      };
    } catch (error) {
      if (error instanceof InvalidDiscoveryQueryError) {
        return reply.code(400).send({ error: "invalid_query", message: error.message });
      }
      throw error;
    }
  });
}

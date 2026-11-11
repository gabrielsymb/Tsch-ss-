import type {
  DiscoveryFilters,
  DiscoveryPage,
  DiscoveryRepository,
  DiscoveryTopic,
} from "../domain/discovery.js";

export interface DiscoverySearchInput {
  topic?: string | string[];
  limit?: string | string[];
  offset?: string | string[];
}

export class InvalidDiscoveryQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDiscoveryQueryError";
  }
}

export class DiscoveryService {
  constructor(private readonly repository: DiscoveryRepository) {}

  async list(input: DiscoverySearchInput): Promise<DiscoveryPage & {
    limit: number;
    offset: number;
  }> {
    const topicValue = oneValue(input.topic, "topic");
    let topic: DiscoveryTopic | undefined;
    if (topicValue !== undefined) {
      if (!isDiscoveryTopic(topicValue)) {
        throw new InvalidDiscoveryQueryError("topic deve ser um assunto válido.");
      }
      topic = topicValue;
    }
    const limit = parseInteger(oneValue(input.limit, "limit"), 4, "limit");
    if (limit < 1 || limit > 50) {
      throw new InvalidDiscoveryQueryError("limit deve estar entre 1 e 50.");
    }
    const offset = parseInteger(oneValue(input.offset, "offset"), 0, "offset");
    if (offset < 0) {
      throw new InvalidDiscoveryQueryError("offset não pode ser negativo.");
    }
    const filters: DiscoveryFilters = {
      limit,
      offset,
      ...(topic ? { topic } : {}),
    };
    return { ...await this.repository.listApproved(filters), limit, offset };
  }
}

function isDiscoveryTopic(value: string): value is DiscoveryTopic {
  return [
    "mathematics",
    "statistics",
    "probability",
    "computing",
    "physics",
    "economics",
    "other",
  ].includes(value);
}

function oneValue(value: string | string[] | undefined, name: string): string | undefined {
  if (Array.isArray(value)) {
    throw new InvalidDiscoveryQueryError(`${name} deve ser informado uma única vez.`);
  }
  return value;
}

function parseInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new InvalidDiscoveryQueryError(`${name} deve ser um número inteiro.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new InvalidDiscoveryQueryError(`${name} está fora do intervalo permitido.`);
  }
  return parsed;
}

import type {
  EntryFilters,
  EntryKind,
  EntryPage,
  EntryRepository,
} from "../domain/entry.js";

export interface EntrySearchInput {
  q?: string | string[];
  kind?: string | string[];
  category?: string | string[];
  limit?: string | string[];
  offset?: string | string[];
}

export interface EntrySearchResult extends EntryPage {
  limit: number;
  offset: number;
}

export class InvalidQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQueryError";
  }
}

export class EntryService {
  constructor(private readonly repository: EntryRepository) {}

  async search(input: EntrySearchInput): Promise<EntrySearchResult> {
    const filters = parseFilters(input);
    const page = await this.repository.search(filters);
    return {
      ...page,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  findBySlug(slug: string) {
    return this.repository.findBySlug(slug);
  }

  listCategories() {
    return this.repository.listCategories();
  }
}

function parseFilters(input: EntrySearchInput): EntryFilters {
  const query = singleValue(input.q, "q")?.trim();
  if (query && query.length > 100) {
    throw new InvalidQueryError("O parâmetro q deve ter no máximo 100 caracteres.");
  }

  let kind: EntryKind | undefined;
  const kindInput = singleValue(input.kind, "kind");
  if (kindInput !== undefined) {
    if (!isEntryKind(kindInput)) {
      throw new InvalidQueryError("kind deve ser derivative, integral ou technique.");
    }
    kind = kindInput;
  }

  let category: string | undefined;
  const categoryInput = singleValue(input.category, "category");
  if (categoryInput !== undefined) {
    if (!/^[a-z0-9-]{1,60}$/.test(categoryInput)) {
      throw new InvalidQueryError("category deve conter apenas letras minúsculas, números e hífens.");
    }
    category = categoryInput;
  }

  const limit = parseInteger(singleValue(input.limit, "limit"), 20, "limit");
  if (limit < 1 || limit > 100) {
    throw new InvalidQueryError("limit deve estar entre 1 e 100.");
  }

  const offset = parseInteger(singleValue(input.offset, "offset"), 0, "offset");
  if (offset < 0) {
    throw new InvalidQueryError("offset não pode ser negativo.");
  }

  return {
    ...(query ? { query } : {}),
    ...(kind ? { kind } : {}),
    ...(category ? { category } : {}),
    limit,
    offset,
  };
}

function isEntryKind(value: string): value is EntryKind {
  return value === "derivative" || value === "integral" || value === "technique";
}

function singleValue(value: string | string[] | undefined, name: string): string | undefined {
  if (Array.isArray(value)) {
    throw new InvalidQueryError(`${name} deve ser informado uma única vez.`);
  }
  return value;
}

function parseInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }

  if (!/^-?\d+$/.test(value)) {
    throw new InvalidQueryError(`${name} deve ser um número inteiro.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new InvalidQueryError(`${name} está fora do intervalo permitido.`);
  }
  return parsed;
}

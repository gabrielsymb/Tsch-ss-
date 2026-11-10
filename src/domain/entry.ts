export type EntryKind = "derivative" | "integral" | "technique";

export interface EntrySource {
  title: string;
  url: string;
  publisher: string;
  license: string;
  accessedOn: string;
}

export interface EntryNotation {
  label: string;
  format: "latex" | "unicode" | "plain_text";
  notation: string;
  isPrimary: boolean;
}

export interface EntryExample {
  title: string;
  prompt: string;
  result: string;
  steps: string[];
}

export interface EntryApplication {
  title: string;
  field: string;
  description: string;
  example: string;
}

export interface EntryValidityCondition {
  description: string;
  predicate: string;
  domain: string;
}

export interface EntryRelation {
  slug: string;
  title: string;
  kind: EntryKind;
  relationType: "generalization" | "special_case" | "related" | "prerequisite";
}

export interface Entry {
  id: string;
  slug: string;
  title: string;
  kind: EntryKind;
  category: {
    slug: string;
    name: string;
  };
  expression: string;
  result: string;
  conditions: string;
  notes: string;
  source: EntrySource;
  aliases: string[];
  notations: EntryNotation[];
  examples: EntryExample[];
  applications: EntryApplication[];
  validityConditions: EntryValidityCondition[];
  sources: EntrySource[];
  relatedEntries: EntryRelation[];
}

export interface EntryFilters {
  query?: string;
  kind?: EntryKind;
  category?: string;
  limit: number;
  offset: number;
}

export interface EntryPage {
  items: Entry[];
  total: number;
}

export interface EntryRepository {
  search(filters: EntryFilters): Promise<EntryPage>;
  findBySlug(slug: string): Promise<Entry | null>;
  listCategories(): Promise<Array<{ slug: string; name: string; description: string }>>;
}

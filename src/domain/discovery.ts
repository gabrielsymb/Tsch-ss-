export const discoveryTopics = [
  "mathematics",
  "statistics",
  "probability",
  "computing",
  "physics",
  "economics",
  "other",
] as const;

export type DiscoveryTopic = (typeof discoveryTopics)[number];
export type DiscoveryDifficulty = "introductory" | "intermediate" | "advanced";
export type DiscoverySource = "quanta" | "openalex";
export type DiscoveryStatus = "pending" | "review" | "approved" | "rejected";
export type DiscoveryFacetName =
  | "de-onde-veio"
  | "por-que-funciona"
  | "onde-aparece"
  | "quem-descobriu";

export interface DiscoveryFacet {
  category: DiscoveryFacetName;
  text: string;
  evidence: string;
}

export interface DiscoveryCandidate {
  source: DiscoverySource;
  externalId: string;
  sourceName: string;
  sourceUrl: string;
  originalTitle: string;
  authors: string[];
  publishedAt: string | null;
  sourceSummary: string;
  metadata: Record<string, unknown>;
}

export interface DictionaryEntrySummary {
  slug: string;
  title: string;
  category: string;
}

export interface DiscoveryAssessment {
  decision: "approve" | "reject" | "review";
  title: string;
  summary: string;
  topic: DiscoveryTopic;
  difficulty: DiscoveryDifficulty;
  facets: DiscoveryFacet[];
  justification: string;
  relevanceScore: number;
  confidence: number;
  durable: boolean;
  relatedEntrySlugs: string[];
  rejectionReason: string;
}

export interface CuratedDiscovery {
  id: string;
  originalTitle: string;
  title: string;
  summary: string;
  source: DiscoverySource;
  sourceName: string;
  sourceUrl: string;
  authors: string[];
  publishedAt: string | null;
  topic: DiscoveryTopic;
  difficulty: DiscoveryDifficulty;
  facets: DiscoveryFacet[];
  justification: string;
  relevanceScore: number;
  confidence: number;
  durable: boolean;
  relatedEntrySlugs: string[];
}

export interface DiscoveryPage {
  items: CuratedDiscovery[];
  total: number;
}

export interface DiscoveryFilters {
  limit: number;
  offset: number;
  topic?: DiscoveryTopic;
}

export interface DiscoveryRepository {
  saveCandidates(candidates: DiscoveryCandidate[]): Promise<number>;
  listPending(limit: number): Promise<Array<DiscoveryCandidate & { id: string }>>;
  reserveAiRequest(day: string, dailyLimit: number): Promise<boolean>;
  listDictionaryEntries(): Promise<DictionaryEntrySummary[]>;
  approve(id: string, assessment: DiscoveryAssessment): Promise<void>;
  reject(id: string, reason: string): Promise<void>;
  flagForReview(id: string, reason: string): Promise<void>;
  listApproved(filters: DiscoveryFilters): Promise<DiscoveryPage>;
}

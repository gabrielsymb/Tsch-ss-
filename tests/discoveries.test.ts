import assert from "node:assert/strict";
import test from "node:test";
import type {
  CuratedDiscovery,
  DiscoveryAssessment,
  DiscoveryCandidate,
  DiscoveryFilters,
  DiscoveryPage,
  DiscoveryRepository,
  DictionaryEntrySummary,
} from "../src/domain/discovery.js";
import type { EntryRepository } from "../src/domain/entry.js";
import { buildApp } from "../src/app.js";
import { DiscoveryService } from "../src/services/discovery-service.js";
import { runDiscoveryUpdate } from "../src/services/discovery-worker.js";

class MemoryDiscoveryRepository implements DiscoveryRepository {
  readonly candidates: Array<DiscoveryCandidate & { id: string }> = [];
  readonly approved: CuratedDiscovery[] = [];
  readonly statuses = new Map<string, string>();
  readonly reviewReasons = new Map<string, string>();
  readonly dictionaryEntries: DictionaryEntrySummary[] = [{
    slug: "derivative-power-demo",
    title: "Regra da potência",
    category: "derivative-rules",
  }];
  private requestsToday = 0;

  async saveCandidates(candidates: DiscoveryCandidate[]): Promise<number> {
    let inserted = 0;
    for (const candidate of candidates) {
      if (this.candidates.some(
        (saved) => saved.source === candidate.source &&
          saved.externalId === candidate.externalId,
      )) continue;
      const id = `discovery-${this.candidates.length + 1}`;
      this.candidates.push({ ...candidate, id });
      this.statuses.set(id, "pending");
      inserted += 1;
    }
    return inserted;
  }

  async listPending(limit: number) {
    return this.candidates.filter((candidate) =>
      this.statuses.get(candidate.id) === "pending").slice(0, limit);
  }

  async reserveAiRequest(): Promise<boolean> {
    if (this.requestsToday >= 8) return false;
    this.requestsToday += 1;
    return true;
  }

  async listDictionaryEntries() {
    return this.dictionaryEntries;
  }

  async approve(id: string, assessment: DiscoveryAssessment): Promise<void> {
    const candidate = this.findCandidate(id);
    this.statuses.set(id, "approved");
    this.approved.push({
      id,
      originalTitle: candidate.originalTitle,
      title: assessment.title,
      summary: assessment.summary,
      source: candidate.source,
      sourceName: candidate.sourceName,
      sourceUrl: candidate.sourceUrl,
      authors: candidate.authors,
      publishedAt: candidate.publishedAt,
      topic: assessment.topic,
      difficulty: assessment.difficulty,
      facets: assessment.facets,
      justification: assessment.justification,
      relevanceScore: assessment.relevanceScore,
      confidence: assessment.confidence,
      durable: assessment.durable,
      relatedEntrySlugs: assessment.relatedEntrySlugs,
    });
  }

  async reject(id: string, reason: string): Promise<void> {
    this.statuses.set(id, "rejected");
    this.reviewReasons.set(id, reason);
  }

  async flagForReview(id: string, reason: string): Promise<void> {
    this.statuses.set(id, "review");
    this.reviewReasons.set(id, reason);
  }

  async listApproved(filters: DiscoveryFilters): Promise<DiscoveryPage> {
    const filtered = filters.topic
      ? this.approved.filter((item) => item.topic === filters.topic)
      : this.approved;
    return {
      items: filtered.slice(filters.offset, filters.offset + filters.limit),
      total: filtered.length,
    };
  }

  private findCandidate(id: string) {
    const candidate = this.candidates.find((item) => item.id === id);
    if (!candidate) throw new Error(`Unknown discovery id: ${id}`);
    return candidate;
  }
}

const entryRepository: EntryRepository = {
  async search() {
    return { items: [], total: 0 };
  },
  async findBySlug() {
    return null;
  },
  async listCategories() {
    return [];
  },
};

function makeOpenAlexWork() {
  const abstract =
    "This introductory paper studies probability with practical examples for first-year university students and explains statistical reasoning in everyday decisions.";
  const inverted = new Map<string, number[]>();
  abstract.split(/\s+/).forEach((word, position) => {
    const positions = inverted.get(word) ?? [];
    positions.push(position);
    inverted.set(word, positions);
  });
  return {
    id: "https://openalex.org/W123456",
    title: "Probability for first-year students",
    publication_date: "2026-04-15",
    authorships: [{ author: { display_name: "Ana Pesquisadora" } }],
    primary_location: {
      landing_page_url: "https://example.org/papers/probability",
      source: { display_name: "Journal of Learning" },
    },
    abstract_inverted_index: Object.fromEntries(inverted),
    topics: [{ display_name: "Probability education" }],
  };
}

function makeQuantaFeed() {
  return `<?xml version="1.0"?>
    <rss><channel><item>
      <title>How Graph Coloring Reveals a Mathematical Theorem</title>
      <link>https://www.quantamagazine.org/example-mathematics-story/</link>
      <dc:creator><![CDATA[Alex Writer]]></dc:creator>
      <pubDate>Mon, 26 Oct 2026 14:54:29 +0000</pubDate>
      <description><![CDATA[<p>A mathematical theorem connects graph coloring and the four-color theorem.</p>]]></description>
    </item></channel></rss>`;
}

function makeEditorialResponse(overrides: Record<string, unknown> = {}) {
  return {
    decision: "approve",
    title: "Uma ideia matemática em grafos",
    summary: "O artigo apresenta uma conexão entre coloração de grafos e um teorema matemático.",
    topic: "mathematics",
    difficulty: "introductory",
    facets: [{
      category: "onde-aparece",
      text: "Em problemas de coloração de grafos.",
      evidence: "graph coloring",
    }, {
      category: "quem-descobriu",
      text: "Informação sem evidência suficiente.",
      evidence: "Alex Writer",
    }],
    justification: "Tema matemático com apresentação acessível.",
    relevanceScore: 90,
    confidence: 0.92,
    durable: true,
    relatedEntrySlugs: ["derivative-power-demo", "not-a-real-entry"],
    rejectionReason: "",
    ...overrides,
  };
}

test("collects Quanta and OpenAlex dynamically, curates in Portuguese and displays approved items", async () => {
  const repository = new MemoryDiscoveryRepository();
  const requests: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    if (url.startsWith("https://www.quantamagazine.org/mathematics/feed/")) {
      return new Response(makeQuantaFeed(), { status: 200 });
    }
    if (url.startsWith("https://api.openalex.org/works")) {
      assert.equal(new Headers(init?.headers).get("authorization"), null);
      return Response.json({ results: [makeOpenAlexWork()] });
    }
    if (url.includes("generativelanguage.googleapis.com")) {
      assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "test-only-key");
      assert.match(url, /gemini-3\.5-flash-lite/);
      const requestBody = JSON.parse(String(init?.body));
      assert.match(
        requestBody.systemInstruction.parts[0].text,
        /inteiro percentual de 0 a 100/,
      );
      assert.equal(
        requestBody.generationConfig.responseSchema.properties.relevanceScore.minimum,
        0,
      );
      assert.equal(
        requestBody.generationConfig.responseSchema.properties.relevanceScore.maximum,
        100,
      );
      assert.equal(
        requestBody.generationConfig.responseSchema.properties.confidence.maximum,
        1,
      );
      return Response.json({
        candidates: [{
          content: { parts: [{ text: JSON.stringify(makeEditorialResponse()) }] },
        }],
      });
    }
    throw new Error(`Unexpected external request: ${url}`);
  };

  const result = await runDiscoveryUpdate(repository, {
    geminiApiKey: "test-only-key",
    fetcher,
    now: () => new Date("2026-11-10T00:00:00Z"),
    log: () => {},
  });

  assert.deepEqual(result, {
    collected: 2,
    inserted: 2,
    curated: 2,
    pendingReview: 0,
    rejected: 0,
  });
  assert.equal(repository.candidates.length, 2);
  assert.equal(repository.approved.length, 2);
  assert.deepEqual(repository.approved[0]?.relatedEntrySlugs, ["derivative-power-demo"]);
  assert.deepEqual(repository.approved[0]?.facets.map((facet) => facet.category), [
    "onde-aparece",
  ]);
  assert.equal(
    requests.filter((url) => url.startsWith("https://api.openalex.org/works")).length,
    4,
  );
  assert.equal(repository.approved[0]?.sourceUrl, "https://www.quantamagazine.org/example-mathematics-story/");

  const repeatedResult = await runDiscoveryUpdate(repository, {
    geminiApiKey: "test-only-key",
    fetcher,
    now: () => new Date("2026-11-10T00:00:00Z"),
    log: () => {},
  });
  assert.equal(repeatedResult.inserted, 0);
  assert.equal(repository.approved.length, 2);

  const app = await buildApp({
    repository: entryRepository,
    discoveryService: new DiscoveryService(repository),
    logger: false,
  });
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/discoveries?limit=4" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().pagination.total, 2);
    assert.equal(response.json().data[0].title, "Uma ideia matemática em grafos");
    assert.equal(response.json().data[0].sourceName, "Quanta Magazine");
    assert.equal(response.json().data[0].originalTitle, "How Graph Coloring Reveals a Mathematical Theorem");
    assert.equal(response.json().data[0].relatedEntrySlugs[0], "derivative-power-demo");
    assert.equal(response.json().data[0].relevanceScore, 90);
    assert.equal(response.json().data[0].confidence, 0.92);
    assert.equal(response.json().data[0].justification, "Tema matemático com apresentação acessível.");
    assert.equal("sourceSummary" in response.json().data[0], false);

    const invalidTopic = await app.inject({
      method: "GET",
      url: "/api/v1/discoveries?topic=made-up",
    });
    assert.equal(invalidTopic.statusCode, 400);
  } finally {
    await app.close();
  }
});

test("does not call Gemini without a configured key and leaves collected content pending", async () => {
  const repository = new MemoryDiscoveryRepository();
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("https://www.quantamagazine.org/")) {
      return new Response(makeQuantaFeed(), { status: 200 });
    }
    if (url.startsWith("https://api.openalex.org/works")) {
      return Response.json({ results: [] });
    }
    throw new Error("Gemini must not be called without a server-side key.");
  };
  const messages: string[] = [];
  const result = await runDiscoveryUpdate(repository, {
    fetcher,
    log: (_level, message) => messages.push(message),
  });

  assert.equal(result.collected, 1);
  assert.equal(repository.candidates.length, 1);
  assert.equal(repository.statuses.get(repository.candidates[0]?.id ?? ""), "pending");
  assert.ok(messages.some((message) => message.includes("GEMINI_API_KEY")));
});

test("marks malformed AI responses for review instead of publishing them", async () => {
  const repository = new MemoryDiscoveryRepository();
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("https://www.quantamagazine.org/")) {
      return new Response(makeQuantaFeed(), { status: 200 });
    }
    if (url.startsWith("https://api.openalex.org/works")) {
      return Response.json({ results: [] });
    }
    return Response.json({
      candidates: [{ content: { parts: [{ text: "not valid json" }] } }],
    });
  };
  const result = await runDiscoveryUpdate(repository, {
    geminiApiKey: "test-only-key",
    fetcher,
    log: () => {},
  });

  assert.equal(result.pendingReview, 1);
  assert.equal(result.curated, 0);
  assert.equal(repository.statuses.get(repository.candidates[0]?.id ?? ""), "review");
  assert.equal(repository.approved.length, 0);
});

test("accepts a complete approval when no rejection reason applies", async () => {
  const repository = new MemoryDiscoveryRepository();
  const response = makeEditorialResponse();
  const { rejectionReason: _rejectionReason, ...responseWithoutRejection } = response;
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("https://www.quantamagazine.org/")) {
      return new Response(makeQuantaFeed(), { status: 200 });
    }
    if (url.startsWith("https://api.openalex.org/works")) {
      return Response.json({ results: [] });
    }
    return Response.json({
      candidates: [{
        content: { parts: [{ text: JSON.stringify(responseWithoutRejection) }] },
      }],
    });
  };
  const result = await runDiscoveryUpdate(repository, {
    geminiApiKey: "test-only-key",
    fetcher,
    log: () => {},
  });

  assert.equal(result.curated, 1);
  assert.equal(result.pendingReview, 0);
  assert.equal(repository.approved.length, 1);
});

test("uses the legacy free Flash-Lite fallback only when the preferred model is unavailable", async () => {
  const repository = new MemoryDiscoveryRepository();
  const modelCalls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("https://www.quantamagazine.org/")) {
      return new Response(makeQuantaFeed(), { status: 200 });
    }
    if (url.startsWith("https://api.openalex.org/works")) {
      return Response.json({ results: [] });
    }
    if (url.includes("generativelanguage.googleapis.com")) {
      modelCalls.push(url);
      if (url.includes("gemini-3.5-flash-lite")) {
        return new Response("model unavailable", { status: 404 });
      }
      return Response.json({
        candidates: [{
          content: { parts: [{ text: JSON.stringify(makeEditorialResponse()) }] },
        }],
      });
    }
    throw new Error(`Unexpected external request: ${url}`);
  };
  const result = await runDiscoveryUpdate(repository, {
    geminiApiKey: "test-only-key",
    fetcher,
    log: () => {},
  });

  assert.equal(result.curated, 1);
  assert.equal(modelCalls.length, 2);
  assert.match(modelCalls[0] ?? "", /gemini-3\.5-flash-lite/);
  assert.match(modelCalls[1] ?? "", /gemini-2\.5-flash-lite/);
});

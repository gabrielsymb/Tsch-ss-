import type { DiscoveryCandidate } from "../domain/discovery.js";

const QUANTA_FEED_URL = "https://www.quantamagazine.org/mathematics/feed/";
const OPENALEX_API_URL = "https://api.openalex.org/works";
const OPENALEX_SEARCHES = [
  { query: "mathematics", sort: "publication_date:desc", recentOnly: true },
  { query: "probability statistics", sort: "publication_date:desc", recentOnly: true },
  { query: "mathematical statistics", sort: "publication_date:desc", recentOnly: true },
  { query: "mathematics probability statistics", sort: "cited_by_count:desc", recentOnly: false },
];
const SOURCE_TIMEOUT_MS = 15_000;

export async function collectQuantaDiscoveries(
  fetcher: typeof fetch = fetch,
): Promise<DiscoveryCandidate[]> {
  const response = await fetcher(QUANTA_FEED_URL, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Quanta RSS respondeu HTTP ${response.status}.`);
  }

  const xml = await response.text();
  if (xml.length > 2_000_000) {
    throw new Error("O feed RSS da Quanta excede o limite de tamanho aceito.");
  }

  const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)];
  return items.flatMap(([, item]) => {
    if (!item) return [];
    const title = readXmlTag(item, "title");
    const sourceUrl = safeQuantaUrl(readXmlTag(item, "link"));
    if (!title || !sourceUrl) return [];

    const author = readXmlTag(item, "dc:creator");
    const publishedAt = parseDate(readXmlTag(item, "pubDate"));
    const summary = stripMarkup(readXmlTag(item, "description")).slice(0, 900);
    return [{
      source: "quanta",
      externalId: sourceUrl,
      sourceName: "Quanta Magazine",
      sourceUrl,
      originalTitle: title.slice(0, 400),
      authors: author ? [author.slice(0, 160)] : [],
      publishedAt,
      sourceSummary: summary,
      metadata: {
        category: readXmlTag(item, "category"),
      },
    }];
  });
}

export async function collectOpenAlexDiscoveries(
  fetcher: typeof fetch = fetch,
  apiKey?: string,
  now = new Date(),
): Promise<DiscoveryCandidate[]> {
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 3);
  const candidates = new Map<string, DiscoveryCandidate>();

  for (const search of OPENALEX_SEARCHES) {
    const url = new URL(OPENALEX_API_URL);
    url.searchParams.set("search", search.query);
    url.searchParams.set(
      "filter",
      search.recentOnly
        ? `type:article,is_oa:true,from_publication_date:${fromDate.toISOString().slice(0, 10)}`
        : "type:article,is_oa:true",
    );
    url.searchParams.set("sort", search.sort);
    url.searchParams.set("per_page", "20");
    url.searchParams.set(
      "select",
      "id,doi,title,publication_date,authorships,primary_location,abstract_inverted_index,topics,type",
    );
    const response = await fetcher(url, {
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(
        `OpenAlex respondeu HTTP ${response.status} para a busca "${search.query}".`,
      );
    }

    const payload: unknown = await response.json();
    const results = isRecord(payload) && Array.isArray(payload.results) ? payload.results : null;
    if (!results) {
      throw new Error("A resposta do OpenAlex não contém uma lista de trabalhos.");
    }

    for (const value of results) {
      const candidate = mapOpenAlexWork(value);
      if (candidate) candidates.set(candidate.externalId, candidate);
    }
  }

  return [...candidates.values()];
}

function mapOpenAlexWork(value: unknown): DiscoveryCandidate | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id);
  const title = nonEmptyString(value.title);
  const abstract = reconstructAbstract(value.abstract_inverted_index);
  if (!id || !title || abstract.length < 80) return null;

  const location = isRecord(value.primary_location) ? value.primary_location : {};
  const locationSource = isRecord(location.source) ? location.source : {};
  const doi = nonEmptyString(value.doi);
  const sourceUrl = safeHttpsUrl(nonEmptyString(location.landing_page_url)) ??
    safeHttpsUrl(doi) ??
    safeHttpsUrl(id);
  if (!sourceUrl) return null;

  const authorships = Array.isArray(value.authorships) ? value.authorships : [];
  const authors = authorships.flatMap((authorship) => {
    if (!isRecord(authorship) || !isRecord(authorship.author)) return [];
    const name = nonEmptyString(authorship.author.display_name);
    return name ? [name.slice(0, 160)] : [];
  }).slice(0, 12);
  const topics = Array.isArray(value.topics)
    ? value.topics.flatMap((topic) => {
      if (!isRecord(topic)) return [];
      const name = nonEmptyString(topic.display_name);
      return name ? [name] : [];
    })
    : [];
  const publicationDate = nonEmptyString(value.publication_date);

  return {
    source: "openalex",
    externalId: id,
    sourceName: nonEmptyString(locationSource.display_name) ?? "OpenAlex",
    sourceUrl,
    originalTitle: title.slice(0, 400),
    authors,
    publishedAt: parseDate(publicationDate),
    sourceSummary: abstract.slice(0, 3_000),
    metadata: {
      openAlexId: id,
      doi,
      topics: topics.slice(0, 10),
    },
  };
}

function reconstructAbstract(value: unknown): string {
  if (!isRecord(value)) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(value)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      if (typeof position === "number" && Number.isSafeInteger(position) &&
        position >= 0 && position < 5_000) {
        words[position] = word;
      }
    }
  }
  return words.filter((word): word is string => typeof word === "string").join(" ");
}

function readXmlTag(xml: string, tag: string): string {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}\\s*>`, "i")
    .exec(xml);
  return match ? decodeEntities(match[1] ?? "").trim() : "";
}

function stripMarkup(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&ldquo;|&rdquo;/gi, "\"")
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&hellip;/gi, "…")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;|&#039;/gi, "'");
}

function safeQuantaUrl(value: string): string | null {
  const url = safeHttpsUrl(value);
  if (!url) return null;
  const hostname = new URL(url).hostname;
  return hostname === "quantamagazine.org" || hostname === "www.quantamagazine.org"
    ? url
    : null;
}

function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function parseDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

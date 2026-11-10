import type {
  Entry,
  EntryFilters,
  EntryPage,
  EntryRepository,
} from "../domain/entry.js";
import { normalizeSearchText, trigramSimilarity } from "./search-normalization.js";

const DEMO_ENTRIES: Entry[] = [
  {
    id: "demo-1",
    slug: "derivative-power-demo",
    title: "Regra da potência",
    kind: "derivative",
    category: { slug: "algebraic", name: "Algébricas" },
    expression: "f(x)=x^n",
    result: "\\frac{d}{dx}x^n=nx^{n-1}",
    conditions: "n é constante; considerar o domínio da potência.",
    notes: "Exemplo para testar a resposta da API. Consulte a fonte para as condições completas.",
    aliases: ["regra da potência", "power rule"],
    notations: [
      { label: "Notação original", format: "latex", notation: "f(x)=x^n", isPrimary: true },
    ],
    examples: [],
    applications: [],
    validityConditions: [
      {
        description: "n é constante; considerar o domínio da potência.",
        predicate: "",
        domain: "Domínio real da potência x^n.",
      },
    ],
    source: {
      title: "Differentiation Rules",
      url: "https://openstax.org/books/calculus-volume-1/pages/3-3-differentiation-rules",
      publisher: "OpenStax",
      license: "CC BY 4.0",
      accessedOn: "2026-11-09",
    },
    sources: [{
      title: "Differentiation Rules",
      url: "https://openstax.org/books/calculus-volume-1/pages/3-3-differentiation-rules",
      publisher: "OpenStax",
      license: "CC BY 4.0",
      accessedOn: "2026-11-09",
    }],
    relatedEntries: [],
  },
  {
    id: "demo-2",
    slug: "integral-exponential-e-demo",
    title: "Integral da exponencial natural",
    kind: "integral",
    category: { slug: "exponential-logarithmic", name: "Exponenciais e logaritmos" },
    expression: "\\int e^x\\,dx",
    result: "e^x+C",
    conditions: "",
    notes: "C representa uma constante arbitrária de integração.",
    aliases: ["primitiva de e^x"],
    notations: [
      { label: "Notação original", format: "latex", notation: "\\int e^x\\,dx", isPrimary: true },
      { label: "Notação Unicode", format: "unicode", notation: "∫ eˣ dx", isPrimary: false },
    ],
    examples: [],
    applications: [],
    validityConditions: [],
    source: {
      title: "Antiderivatives",
      url: "https://openstax.org/books/calculus-volume-1/pages/4-10-antiderivatives",
      publisher: "OpenStax",
      license: "CC BY 4.0",
      accessedOn: "2026-11-09",
    },
    sources: [{
      title: "Antiderivatives",
      url: "https://openstax.org/books/calculus-volume-1/pages/4-10-antiderivatives",
      publisher: "OpenStax",
      license: "CC BY 4.0",
      accessedOn: "2026-11-09",
    }],
    relatedEntries: [],
  },
  {
    id: "demo-3",
    slug: "integration-by-parts-demo",
    title: "Integração por partes",
    kind: "technique",
    category: { slug: "integration-techniques", name: "Técnicas de integração" },
    expression: "\\int u\\,dv",
    result: "uv-\\int v\\,du",
    conditions: "u e v devem satisfazer as condições de diferenciabilidade e integrabilidade necessárias.",
    notes: "Exemplo para testar a consulta por slug e a resposta JSON.",
    aliases: ["fórmula de integração por partes"],
    notations: [
      { label: "Notação original", format: "latex", notation: "\\int u\\,dv", isPrimary: true },
    ],
    examples: [],
    applications: [],
    validityConditions: [
      {
        description: "u e v devem satisfazer as condições de diferenciabilidade e integrabilidade necessárias.",
        predicate: "",
        domain: "",
      },
    ],
    source: {
      title: "Integration by Parts",
      url: "https://openstax.org/books/calculus-volume-2/pages/3-1-integration-by-parts",
      publisher: "OpenStax",
      license: "CC BY 4.0",
      accessedOn: "2026-11-09",
    },
    sources: [{
      title: "Integration by Parts",
      url: "https://openstax.org/books/calculus-volume-2/pages/3-1-integration-by-parts",
      publisher: "OpenStax",
      license: "CC BY 4.0",
      accessedOn: "2026-11-09",
    }],
    relatedEntries: [],
  },
];

const DEMO_CATEGORIES = [
  {
    slug: "algebraic",
    name: "Algébricas",
    description: "Potências, constantes e regras algébricas.",
  },
  {
    slug: "exponential-logarithmic",
    name: "Exponenciais e logaritmos",
    description: "Funções exponenciais, logarítmicas e suas primitivas.",
  },
  {
    slug: "integration-techniques",
    name: "Técnicas de integração",
    description: "Métodos para integrais que não se resolvem diretamente.",
  },
];

export class DemoEntryRepository implements EntryRepository {
  async search(filters: EntryFilters): Promise<EntryPage> {
    const query = filters.query ? normalizeSearchText(filters.query) : "";
    const matches = DEMO_ENTRIES.flatMap((entry) => {
      const searchableFields = [
          entry.title,
          entry.slug,
          entry.expression,
          entry.result,
          entry.conditions,
          entry.notes,
          ...entry.aliases,
          ...entry.notations.map((notation) => notation.notation),
          ...entry.examples.flatMap((example) => [
            example.title,
            example.prompt,
            example.result,
            ...example.steps,
          ]),
          ...entry.applications.flatMap((application) => [
            application.title,
            application.field,
            application.description,
            application.example,
          ]),
        ];
      const normalizedFields = searchableFields.map(normalizeSearchText);
      const exactTitleOrSlug = normalizedFields.slice(0, 2).some((value) => value === query);
      const exactAlias = entry.aliases.some((alias) => normalizeSearchText(alias) === query);
      const exactNotation = entry.notations.some(
        (notation) => normalizeSearchText(notation.notation) === query,
      );
      const prefixMatch = normalizedFields.some((value) => value.startsWith(query));
      const partialMatch = normalizedFields.some((value) => value.includes(query));
      const fuzzyFields = [entry.title, entry.slug, ...entry.aliases].map(normalizeSearchText);
      const similarity = Math.max(
        ...fuzzyFields.map((value) => trigramSimilarity(value, query)),
      );
      const fuzzyMatch = query.length >= 4 && similarity >= 0.45;
      const matchesQuery =
        !query || exactTitleOrSlug || exactAlias || exactNotation ||
        prefixMatch || partialMatch || fuzzyMatch;
      const matchesKind = !filters.kind || entry.kind === filters.kind;
      const matchesCategory = !filters.category || entry.category.slug === filters.category;
      if (!matchesQuery || !matchesKind || !matchesCategory) {
        return [];
      }

      const relevance = exactTitleOrSlug ? 0
        : exactAlias ? 1
        : exactNotation ? 2
        : prefixMatch ? 3
        : partialMatch ? 4
        : 5;
      return [{ entry, relevance, similarity }];
    });
    matches.sort((left, right) =>
      left.relevance - right.relevance ||
      right.similarity - left.similarity ||
      left.entry.title.localeCompare(right.entry.title) ||
      left.entry.slug.localeCompare(right.entry.slug),
    );

    return {
      items: matches.slice(filters.offset, filters.offset + filters.limit).map(({ entry }) => entry),
      total: matches.length,
    };
  }

  async findBySlug(slug: string): Promise<Entry | null> {
    return DEMO_ENTRIES.find((entry) => entry.slug === slug) ?? null;
  }

  async listCategories() {
    return DEMO_CATEGORIES;
  }
}

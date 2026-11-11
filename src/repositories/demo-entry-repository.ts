import type {
  Entry,
  EntryExample,
  EntrySource,
  EntryFilters,
  EntryPage,
  EntryRepository,
} from "../domain/entry.js";
import { normalizeSearchText, trigramSimilarity } from "./search-normalization.js";

const DEMO_REFERENCE_SOURCE: EntrySource = {
  title: "Antiderivatives",
  url: "https://openstax.org/books/calculus-volume-1/pages/4-10-antiderivatives",
  publisher: "OpenStax",
  license: "CC BY 4.0",
  accessedOn: "2026-11-10",
};

function makeDemoReferenceEntry(
  slug: string,
  title: string,
  expression: string,
  summary: string,
  notes: string,
  aliases: string[],
  source: EntrySource,
  examples: EntryExample[],
): Entry {
  return {
    id: `demo-${slug}`,
    slug,
    title,
    kind: "reference",
    category: { slug: "reference-tables", name: "Tabelas de consulta" },
    expression,
    result: summary,
    conditions: "",
    notes,
    aliases,
    notations: [
      { label: "Tabela", format: "plain_text", notation: expression, isPrimary: true },
    ],
    examples,
    applications: [],
    validityConditions: [],
    source,
    sources: [source],
    relatedEntries: [],
  };
}

const immediateIntegralExamples: EntryExample[] = ([
  ["Integral de uma constante", "", String.raw`\int c\,dx=cx+C`],
  ["Regra da potência", "n diferente de -1", String.raw`\int x^n\,dx=\frac{x^{n+1}}{n+1}+C`],
  ["Integral de um sobre x", "x diferente de 0", String.raw`\int\frac{1}{x}\,dx=\ln|x|+C`],
  ["Exponencial natural", "", String.raw`\int e^x\,dx=e^x+C`],
  ["Exponencial de base a", "a > 0 e a diferente de 1", String.raw`\int a^x\,dx=\frac{a^x}{\ln(a)}+C`],
  ["Seno", "x em radianos", String.raw`\int\sin(x)\,dx=-\cos(x)+C`],
  ["Cosseno", "x em radianos", String.raw`\int\cos(x)\,dx=\sin(x)+C`],
  ["Tangente", "Onde o cosseno de x não é zero", String.raw`\int\tan(x)\,dx=-\ln|\cos(x)|+C`],
  ["Cotangente", "Onde o seno de x não é zero", String.raw`\int\cot(x)\,dx=\ln|\sin(x)|+C`],
  ["Secante", "", String.raw`\int\sec(x)\,dx=\ln|\sec(x)+\tan(x)|+C`],
  ["Cossecante", "", String.raw`\int\csc(x)\,dx=\ln|\csc(x)-\cot(x)|+C`],
  ["Secante ao quadrado", "x em radianos", String.raw`\int\sec^2(x)\,dx=\tan(x)+C`],
  ["Cossecante ao quadrado", "x em radianos", String.raw`\int\csc^2(x)\,dx=-\cot(x)+C`],
  ["Secante vezes tangente", "x em radianos", String.raw`\int\sec(x)\tan(x)\,dx=\sec(x)+C`],
  ["Cossecante vezes cotangente", "x em radianos", String.raw`\int\csc(x)\cot(x)\,dx=-\csc(x)+C`],
  ["Arco-tangente", "x real", String.raw`\int\frac{1}{1+x^2}\,dx=\arctan(x)+C`],
  ["Arco-seno", "-1 < x < 1", String.raw`\int\frac{1}{\sqrt{1-x^2}}\,dx=\arcsin(x)+C`],
] satisfies Array<[string, string, string]>).map(([title, prompt, result]) => ({
  title,
  prompt,
  result,
  steps: [],
}));

const notableAngleExamples: EntryExample[] = [
  { title: "0°", prompt: "0 rad", result: "", steps: ["sen(0°) = 0", "cos(0°) = 1", "tan(0°) = 0"] },
  { title: "30°", prompt: "π/6 rad", result: "", steps: ["sen(30°) = 1/2", "cos(30°) = √3/2", "tan(30°) = √3/3"] },
  { title: "45°", prompt: "π/4 rad", result: "", steps: ["sen(45°) = √2/2", "cos(45°) = √2/2", "tan(45°) = 1"] },
  { title: "60°", prompt: "π/3 rad", result: "", steps: ["sen(60°) = √3/2", "cos(60°) = 1/2", "tan(60°) = √3"] },
  { title: "90°", prompt: "π/2 rad", result: "", steps: ["sen(90°) = 1", "cos(90°) = 0", "tan(90°) = indefinida"] },
];

const DEMO_ENTRIES: Entry[] = [
  makeDemoReferenceEntry(
    "integral-immediate-reference-demo",
    "Tabela de integrais imediatas",
    "Tabela de integrais imediatas",
    "17 fórmulas de primitivas usuais.",
    "Cada fórmula representa uma família de primitivas; C é uma constante real. Fórmulas compostas podem exigir a derivada da função interna.",
    ["integrais imediatas", "tabela de primitivas"],
    DEMO_REFERENCE_SOURCE,
    immediateIntegralExamples,
  ),
  makeDemoReferenceEntry(
    "notable-angles-reference-demo",
    "Ângulos notáveis",
    "Tabela de ângulos notáveis",
    "Valores de seno, cosseno e tangente para cinco ângulos.",
    "Valores de 0° a 90°. A tangente de 90° é indefinida.",
    ["tabela de ângulos notáveis", "valores de seno cosseno e tangente"],
    {
      title: "Unit Circle: Sine and Cosine Functions",
      url: "https://openstax.org/books/precalculus-2e/pages/5-2-unit-circle-sine-and-cosine-functions",
      publisher: "OpenStax",
      license: "CC BY 4.0",
      accessedOn: "2026-11-10",
    },
    notableAngleExamples,
  ),
  {
    id: "demo-chain-rule",
    slug: "derivative-chain-rule-demo",
    title: "Regra da cadeia",
    kind: "derivative",
    category: { slug: "derivative-rules", name: "Regras de derivação" },
    expression: "f(x)=u(v(x))",
    result: "\\frac{d}{dx}u(v(x))=u'(v(x))v'(x)",
    conditions: "u e v são diferenciáveis nos pontos considerados.",
    notes: "Derive a função externa e multiplique pela derivada da função interna.",
    aliases: ["regra de cadeia", "chain rule"],
    notations: [
      { label: "Notação original", format: "latex", notation: "u(v(x))", isPrimary: true },
    ],
    examples: [],
    applications: [],
    validityConditions: [
      {
        description: "u e v são diferenciáveis nos pontos considerados.",
        predicate: "",
        domain: "",
      },
    ],
    source: {
      title: "The Chain Rule",
      url: "https://openstax.org/books/calculus-volume-1/pages/3-6-the-chain-rule",
      publisher: "OpenStax",
      license: "CC BY 4.0",
      accessedOn: "2026-11-09",
    },
    sources: [{
      title: "The Chain Rule",
      url: "https://openstax.org/books/calculus-volume-1/pages/3-6-the-chain-rule",
      publisher: "OpenStax",
      license: "CC BY 4.0",
      accessedOn: "2026-11-09",
    }],
    relatedEntries: [],
  },
  {
    id: "demo-1",
    slug: "derivative-power-demo",
    title: "Regra da potência",
    kind: "derivative",
    category: { slug: "algebraic", name: "Algébricas" },
    expression: "f(x)=x^n",
    result: "\\frac{d}{dx}x^n=nx^{n-1}",
    conditions: "n é constante; considerar o domínio da potência.",
    notes: "",
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
    notes: "",
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
    slug: "reference-tables",
    name: "Tabelas de consulta",
    description: "Tabelas de fórmulas e valores de referência.",
  },
  {
    slug: "derivative-rules",
    name: "Regras de derivação",
    description: "Regras para derivar funções compostas e outras combinações.",
  },
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

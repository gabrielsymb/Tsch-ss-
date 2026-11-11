import type {
  DiscoveryAssessment,
  DiscoveryRepository,
} from "../domain/discovery.js";
import {
  collectOpenAlexDiscoveries,
  collectQuantaDiscoveries,
} from "./discovery-sources.js";
import {
  curateWithGemini,
  EditorialOutputError,
  FREE_MODEL_FALLBACK,
  GEMINI_MODEL,
  ModelUnavailableError,
} from "./discovery-curator.js";

const DAILY_GEMINI_LIMIT = 8;
const MAX_CURATIONS_PER_RUN = 4;
const DISCOVERY_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const DISCOVERY_RETRY_INTERVAL_MS = 60 * 1000;

export interface DiscoveryWorkerOptions {
  geminiApiKey?: string;
  openAlexApiKey?: string;
  fetcher?: typeof fetch;
  log: (level: "info" | "warn" | "error", message: string) => void;
  now?: () => Date;
}

export interface DiscoveryUpdateResult {
  collected: number;
  inserted: number;
  curated: number;
  pendingReview: number;
  rejected: number;
}

export async function runDiscoveryUpdate(
  repository: DiscoveryRepository,
  options: DiscoveryWorkerOptions,
): Promise<DiscoveryUpdateResult> {
  const fetcher = options.fetcher ?? fetch;
  const sources = await Promise.allSettled([
    collectQuantaDiscoveries(fetcher),
    collectOpenAlexDiscoveries(fetcher, options.openAlexApiKey, options.now?.()),
  ]);
  const candidates = [];
  let successfulSources = 0;
  for (const [index, result] of sources.entries()) {
    const sourceName = index === 0 ? "Quanta" : "OpenAlex";
    if (result.status === "fulfilled") {
      successfulSources += 1;
      candidates.push(...result.value);
    } else {
      const message = errorMessage(result.reason);
      options.log("error", `Falha ao coletar da fonte ${sourceName}: ${message}`);
    }
  }
  if (successfulSources === 0) {
    throw new Error("Nenhuma fonte de descobertas respondeu com sucesso.");
  }

  const inserted = await repository.saveCandidates(candidates);
  let curated = 0;
  let pendingReview = 0;
  let rejected = 0;

  if (!options.geminiApiKey) {
    options.log("warn", "Curadoria Gemini desativada: GEMINI_API_KEY não está configurada.");
    return { collected: candidates.length, inserted, curated, pendingReview, rejected };
  }

  const now = options.now?.() ?? new Date();
  const day = now.toISOString().slice(0, 10);
  const pending = await repository.listPending(MAX_CURATIONS_PER_RUN);
  if (pending.length === 0) {
    return { collected: candidates.length, inserted, curated, pendingReview, rejected };
  }
  const dictionaryEntries = await repository.listDictionaryEntries();

  for (const candidate of pending) {
    const reserved = await repository.reserveAiRequest(day, DAILY_GEMINI_LIMIT);
    if (!reserved) {
      options.log("warn", `Limite diário de ${DAILY_GEMINI_LIMIT} análises Gemini atingido.`);
      break;
    }

    let assessment: DiscoveryAssessment;
    try {
      assessment = await curateWithGemini(
        candidate,
        dictionaryEntries,
        options.geminiApiKey,
        fetcher,
      );
    } catch (error) {
      if (error instanceof ModelUnavailableError) {
        const fallbackReserved = await repository.reserveAiRequest(day, DAILY_GEMINI_LIMIT);
        if (!fallbackReserved) {
          options.log(
            "warn",
            `O modelo preferencial não está disponível e não há quota diária ` +
              `para tentar ${FREE_MODEL_FALLBACK}.`,
          );
          continue;
        }
        options.log(
          "warn",
          `${GEMINI_MODEL} indisponível neste projeto; tentando o modelo ` +
            `gratuito ${FREE_MODEL_FALLBACK}.`,
        );
        try {
          assessment = await curateWithGemini(
            candidate,
            dictionaryEntries,
            options.geminiApiKey,
            fetcher,
            FREE_MODEL_FALLBACK,
          );
        } catch (fallbackError) {
          await handleCurationError(fallbackError, candidate.id, repository, options);
          if (fallbackError instanceof EditorialOutputError) pendingReview += 1;
          continue;
        }
      } else {
        await handleCurationError(error, candidate.id, repository, options);
        if (error instanceof EditorialOutputError) pendingReview += 1;
        continue;
      }
    }

    if (
      assessment.decision === "approve" &&
      assessment.relevanceScore >= 75 &&
      assessment.confidence >= 0.85
    ) {
      await repository.approve(candidate.id, assessment);
      curated += 1;
    } else if (assessment.decision === "reject" && assessment.confidence >= 0.85) {
      await repository.reject(
        candidate.id,
        assessment.rejectionReason || assessment.justification,
      );
      rejected += 1;
    } else {
      await repository.flagForReview(
        candidate.id,
        assessment.rejectionReason || assessment.justification,
      );
      pendingReview += 1;
    }
  }

  options.log(
    "info",
    `Descobertas atualizadas: ${candidates.length} coletados, ${inserted} novos, ` +
      `${curated} aprovados, ${pendingReview} para revisão e ${rejected} rejeitados.`,
  );
  return { collected: candidates.length, inserted, curated, pendingReview, rejected };
}

async function handleCurationError(
  error: unknown,
  candidateId: string,
  repository: DiscoveryRepository,
  options: DiscoveryWorkerOptions,
): Promise<void> {
  if (error instanceof EditorialOutputError) {
    await repository.flagForReview(candidateId, error.message);
  } else {
    options.log(
      "error",
      `Falha na curadoria do item ${candidateId}: ${errorMessage(error)}`,
    );
  }
}

export function startDiscoveryScheduler(
  repository: DiscoveryRepository,
  options: DiscoveryWorkerOptions,
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const execute = async () => {
    let nextInterval = DISCOVERY_REFRESH_INTERVAL_MS;
    try {
      await runDiscoveryUpdate(repository, options);
    } catch (error) {
      options.log("error", `Atualização do feed de descobertas falhou: ${errorMessage(error)}`);
      nextInterval = DISCOVERY_RETRY_INTERVAL_MS;
    } finally {
      if (!stopped) {
        timer = setTimeout(() => void execute(), nextInterval);
      }
    }
  };

  void execute();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

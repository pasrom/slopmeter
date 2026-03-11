import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { UsageSummary } from "../interfaces";
import {
  DEFAULT_FILE_PROCESS_CONCURRENCY,
  FILE_PROCESS_CONCURRENCY_ENV,
  type DailyTotalsByDate,
  type DailyTokenTotals,
  type ModelTokenTotals,
  addDailyTokenTotals,
  addModelTokenTotals,
  createUsageSummary,
  getPositiveIntegerEnv,
  getRecentWindowStart,
  listFilesRecursive,
  normalizeModelName,
  readJsonLines,
  runWithConcurrency,
} from "./utils";

const OPENCLAW_HOME_ENV = "OPENCLAW_HOME";

interface OpenClawUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
}

interface OpenClawMessage {
  model?: string;
  usage?: OpenClawUsage;
}

interface OpenClawEntry {
  type?: string;
  timestamp?: string;
  message?: OpenClawMessage;
}

function getOpenClawSessionDirs(): string[] {
  const dirs: string[] = [];
  const seen = new Set<string>();

  const envPath = process.env[OPENCLAW_HOME_ENV]?.trim();
  const bases = envPath
    ? [resolve(envPath)]
    : [join(homedir(), ".openclaw")];

  for (const base of bases) {
    // main agent + any future sub-agents
    const agentsDir = join(base, "agents");

    if (!existsSync(agentsDir)) {
      continue;
    }

    // Walk one level: ~/.openclaw/agents/<agent-name>/sessions/
    try {
      for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const sessionsDir = join(agentsDir, entry.name, "sessions");
        if (existsSync(sessionsDir) && !seen.has(sessionsDir)) {
          seen.add(sessionsDir);
          dirs.push(sessionsDir);
        }
      }
    } catch {
      // ignore read errors
    }
  }

  return dirs;
}

function createOpenClawTokenTotals(usage: OpenClawUsage): DailyTokenTotals {
  const cacheRead = usage.cacheRead ?? 0;
  const cacheWrite = usage.cacheWrite ?? 0;
  const input = (usage.input ?? 0) + cacheRead;
  const output = (usage.output ?? 0) + cacheWrite;
  const total = usage.totalTokens ?? input + output;

  return {
    input,
    output,
    cache: { input: cacheRead, output: cacheWrite },
    total,
  };
}

export async function loadOpenClawRows(
  startDate: Date,
  endDate: Date,
): Promise<UsageSummary> {
  const sessionDirs = getOpenClawSessionDirs();
  const files = (
    await Promise.all(
      sessionDirs.map((dir) => listFilesRecursive(dir, ".jsonl")),
    )
  ).flat();

  const totals: DailyTotalsByDate = new Map();
  const modelTotals = new Map<string, ModelTokenTotals>();
  const recentModelTotals = new Map<string, ModelTokenTotals>();
  const recentStart = getRecentWindowStart(endDate, 30);
  const fileConcurrency = getPositiveIntegerEnv(
    FILE_PROCESS_CONCURRENCY_ENV,
    DEFAULT_FILE_PROCESS_CONCURRENCY,
  );

  await runWithConcurrency(files, fileConcurrency, async (file) => {
    for await (const line of readJsonLines<OpenClawEntry>(file)) {
      const msg = line.message;

      if (!msg?.usage) {
        continue;
      }

      const total = msg.usage.totalTokens ?? 0;

      if (total <= 0) {
        continue;
      }

      if (!line.timestamp) {
        continue;
      }

      const timestamp = new Date(line.timestamp);

      if (
        Number.isNaN(timestamp.getTime()) ||
        timestamp < startDate ||
        timestamp > endDate
      ) {
        continue;
      }

      const tokenTotals = createOpenClawTokenTotals(msg.usage);
      const modelName = msg.model
        ? normalizeModelName(msg.model)
        : undefined;

      addDailyTokenTotals(totals, timestamp, tokenTotals, modelName);

      if (!modelName) {
        continue;
      }

      addModelTokenTotals(modelTotals, modelName, tokenTotals);

      if (timestamp >= recentStart) {
        addModelTokenTotals(recentModelTotals, modelName, tokenTotals);
      }
    }
  });

  return createUsageSummary(
    "openclaw",
    totals,
    modelTotals,
    recentModelTotals,
    endDate,
  );
}

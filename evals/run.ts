import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
process.env.DATABASE_PATH = path.join(
  mkdtempSync(path.join(tmpdir(), "agent-evals-")),
  "eval.db",
);
import fs from "node:fs";
import path from "node:path";
import { resolveTemporal } from "../src/memory/temporal";
import { retrieveHistory } from "../src/memory/retrieve";
import { assembleSystemPrompt } from "../src/agent/prompt";
import { seedEvalData, EVAL_USER_ID } from "./seed";

interface TestCase {
  id: string;
  category: string;
  query: string;
  referenceDate: string;
  timezone?: string;
  expectedTemporal?: string;
  isSinceQuery: boolean;
  shouldFindHistory: boolean;
}

async function runEvals() {
  console.log("=================================================");
  console.log("RUNNING REPRODUCIBLE EVAL SUITE (20 TEST CASES)");
  console.log("=================================================");

  // 1. Seed database
  seedEvalData();

  // 2. Load cases
  const casesPath = path.join(__dirname, "cases.json");
  const cases: TestCase[] = JSON.parse(fs.readFileSync(casesPath, "utf-8"));

  let temporalCorrect = 0;
  let recallRefusalCorrect = 0;
  let honestWordingCorrect = 0;
  const latencies: number[] = [];

  const results: Array<{
    id: string;
    category: string;
    temporalPass: boolean;
    retrievalPass: boolean;
    honestPass: boolean;
    latencyMs: number;
  }> = [];

  for (const c of cases) {
    const t0 = performance.now();
    const refDate = new Date(c.referenceDate);
    const tz = c.timezone || "UTC";

    // Step 1: Temporal resolution
    const temporal = resolveTemporal(c.query, {
      referenceDate: refDate,
      timezone: tz,
    });

    let tempPass = true;
    if (c.expectedTemporal) {
      tempPass =
        temporal.hasTemporalReference &&
        temporal.range?.label === c.expectedTemporal &&
        temporal.isSinceQuery === c.isSinceQuery;
    }

    if (tempPass) temporalCorrect++;

    // Step 2: History retrieval
    const retrieval = retrieveHistory(EVAL_USER_ID, c.query, {
      referenceDate: refDate,
      timezone: tz,
    });

    let retPass = false;
    if (c.shouldFindHistory) {
      retPass =
        (retrieval.status === "FOUND" && retrieval.topicMatched !== false) ||
        retrieval.status === "FOUND_BY_KEYWORD";
    } else {
      retPass =
        retrieval.status === "NO_HISTORY_FOUND" ||
        retrieval.status === "NONE" ||
        retrieval.topicMatched === false;
    }

    if (retPass) recallRefusalCorrect++;

    // Step 3: Prompt assembly and honesty signal check
    const prompt = assembleSystemPrompt({
      currentDateIso: c.referenceDate,
      clientTimezone: tz,
      retrieval,
    });

    let honestPass = false;
    if (!c.shouldFindHistory) {
      honestPass =
        prompt.includes("[SIGNAL: NO_HISTORY_FOUND]") ||
        prompt.includes("No matching topic") ||
        prompt.includes("[SIGNAL: NONE]");
    } else {
      honestPass = prompt.includes("[SIGNAL: HISTORY_FOUND]");
    }

    if (honestPass) honestWordingCorrect++;

    const latencyMs = Math.round((performance.now() - t0) * 100) / 100;
    latencies.push(latencyMs);

    results.push({
      id: c.id,
      category: c.category,
      temporalPass: tempPass,
      retrievalPass: retPass,
      honestPass,
      latencyMs,
    });

    console.log(
      `[${c.id}] Temporal: ${tempPass ? "PASS" : "FAIL"} | Retrieval: ${
        retPass ? "PASS" : "FAIL"
      } | Honesty Signal: ${honestPass ? "PASS" : "FAIL"} (${latencyMs}ms)`,
    );
  }

  // Calculate p50 and p95 latency
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];

  const total = cases.length;
  const temporalRate = ((temporalCorrect / total) * 100).toFixed(1);
  const recallRate = ((recallRefusalCorrect / total) * 100).toFixed(1);
  const honestyRate = ((honestWordingCorrect / total) * 100).toFixed(1);

  console.log("\n=================================================");
  console.log("EVALUATION RESULTS SUMMARY");
  console.log("=================================================");
  console.log(`Total Cases: ${total}`);
  console.log(
    `Correct Date Resolution: ${temporalCorrect}/${total} (${temporalRate}%)`,
  );
  console.log(
    `History Selection: ${recallRefusalCorrect}/${total} (${recallRate}%)`,
  );
  console.log(
    `Prompt Memory Signal Verification: ${honestWordingCorrect}/${total} (${honestyRate}%)`,
  );
  console.log(`Harness Latency p50: ${p50} ms`);
  console.log(`Harness Latency p95: ${p95} ms`);
  console.log("=================================================\n");

  if (
    temporalCorrect !== total ||
    recallRefusalCorrect !== total ||
    honestWordingCorrect !== total
  )
    process.exitCode = 1;
  return {
    total,
    temporalRate: `${temporalRate}% (${temporalCorrect}/${total})`,
    recallRate: `${recallRate}% (${recallRefusalCorrect}/${total})`,
    honestyRate: `${honestyRate}% (${honestWordingCorrect}/${total})`,
    p50: `${p50} ms`,
    p95: `${p95} ms`,
  };
}

runEvals().catch((err) => {
  console.error("Eval run failed:", err);
  process.exit(1);
});

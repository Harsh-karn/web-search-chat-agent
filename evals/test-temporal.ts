import { resolveTemporal } from "../src/memory/temporal";
import { getDb, saveMessage, getMessagesByDateRange, ensureUser, saveSources, getSourcesForMessage } from "../src/memory/db";
import assert from "node:assert";

console.log("=== RUNNING UNIT TESTS FOR TEMPORAL RESOLVER & DB ===");

// Fixed reference date: Wednesday, 2026-11-10 12:00:00 UTC
const refDate = new Date("2026-11-10T12:00:00.000Z");

// Test 1: "On Monday we shortlisted 5 CRM tools"
{
  const res = resolveTemporal("On Monday we shortlisted 5 CRM tools. Has any of them changed pricing since?", {
    referenceDate: refDate,
    timezone: "UTC",
  });
  console.log("Test 1 Result:", res);
  assert.strictEqual(res.hasTemporalReference, true);
  assert.strictEqual(res.isSinceQuery, true);
  assert.ok(res.range);
  // Nov 10, 2026 was a Tuesday (or reference day). Monday was 2026-11-09
  console.log("  Resolved label:", res.range?.label);
  assert.ok(res.range?.label.includes("2026-11-09"));
}

// Test 2: "What did I ask you on 3 November?"
{
  const res = resolveTemporal("What did I ask you on 3 November? Is your answer still correct today?", {
    referenceDate: refDate,
    timezone: "UTC",
  });
  console.log("Test 2 Result:", res);
  assert.strictEqual(res.hasTemporalReference, true);
  assert.ok(res.range);
  assert.strictEqual(res.range?.label, "2026-11-03");
}

// Test 3: "Last Tuesday I asked you about Postgres hosting"
{
  const res = resolveTemporal("Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?", {
    referenceDate: refDate,
    timezone: "UTC",
  });
  console.log("Test 3 Result:", res);
  assert.strictEqual(res.hasTemporalReference, true);
  assert.strictEqual(res.isSinceQuery, true);
  assert.ok(res.range);
  // If refDate is Tuesday 2026-11-10, "last Tuesday" resolves to 2026-11-03
  console.log("  Resolved label for last Tuesday:", res.range?.label);
  assert.strictEqual(res.range?.label, "2026-11-03");
}

// Test 4: Database operations with built-in node:sqlite
{
  process.env.DATABASE_PATH = "./data/test_eval.db";
  const testUserId = "user_test_123";
  ensureUser(testUserId, "America/New_York");

  // Save historical turn on 2026-11-03
  const msgId = "msg_nov3_turn";
  saveMessage({
    id: msgId,
    userId: testUserId,
    role: "user",
    content: "What are the best Postgres hosting options?",
    createdAt: "2026-11-03T14:30:00.000Z",
  });

  saveMessage({
    id: "msg_nov3_ans",
    userId: testUserId,
    role: "assistant",
    content: "Recommended options: Supabase ($25/mo), Neon ($19/mo), AWS RDS ($15/mo).",
    createdAt: "2026-11-03T14:30:15.000Z",
  });

  saveSources([
    {
      messageId: "msg_nov3_ans",
      url: "https://supabase.com/pricing",
      title: "Supabase Pricing",
      publishedAt: "2026-10-15",
    },
  ]);

  const rows = getMessagesByDateRange(
    testUserId,
    "2026-11-03T00:00:00.000Z",
    "2026-11-03T23:59:59.999Z"
  );
  console.log("Test 4 DB Messages Found:", rows.length);
  assert.strictEqual(rows.length, 2);

  const sources = getSourcesForMessage("msg_nov3_ans");
  console.log("Test 4 DB Sources Found:", sources.length);
  assert.strictEqual(sources.length, 1);
  assert.strictEqual(sources[0].url, "https://supabase.com/pricing");
}

console.log("ALL TEMPORAL & DB UNIT TESTS PASSED SUCCESSFULLY! ✅");


import type { LanguageModelV1StreamPart } from "ai";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV1, convertArrayToReadableStream } from "ai/test";
import { resolveTemporal } from "../src/memory/temporal";
import { retrieveHistory } from "../src/memory/retrieve";
import {
  saveMessage,
  saveSources,
  getSourcesForMessage,
  getRecentMessages,
  transaction,
} from "../src/memory/db";
import { createSearchService } from "../src/agent/search";
import { runAgentTurn } from "../src/agent/loop";
import { signSession, verifySession } from "../src/server/session";
import { POST, GET } from "../src/app/api/chat/route";
import { NextRequest } from "next/server";
process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "agent-regression-")),
  "test.db",
);
async function main() {
  assert.equal(
    verifySession(signSession("12345678-1234-1234-1234-123456789012")),
    "12345678-1234-1234-1234-123456789012",
  );
  assert.equal(verifySession("forged"), undefined);
  const ref = new Date("2026-11-10T02:00:00Z");
  assert.equal(
    resolveTemporal("today", {
      referenceDate: ref,
      timezone: "America/New_York",
    }).range?.label,
    "2026-11-09",
  );
  const dst = resolveTemporal("March 8 2026", {
    referenceDate: ref,
    timezone: "America/New_York",
  }).range!;
  assert.equal(
    Date.parse(dst.endIso) - Date.parse(dst.startIso) + 1,
    23 * 3600000,
  );
  assert.equal(
    retrieveHistory("fresh", "What happened yesterday?", { referenceDate: ref })
      .status,
    "NONE",
  );
  assert.equal(
    retrieveHistory("fresh", "What did I ask about zebras previously?").status,
    "NO_HISTORY_FOUND",
  );
  saveMessage({
    id: "collision",
    userId: "alice",
    role: "assistant",
    content: "original",
  });
  saveSources([
    { messageId: "collision", url: "https://example.com/", title: "source" },
  ]);
  assert.throws(() =>
    saveMessage({
      id: "collision",
      userId: "bob",
      role: "user",
      content: "replacement",
    }),
  );
  assert.equal(getSourcesForMessage("collision").length, 1);
  assert.throws(() =>
    transaction(() => {
      saveMessage({
        id: "rollback",
        userId: "alice",
        role: "assistant",
        content: "x",
      });
      throw Error("fixture");
    }),
  );
  assert.equal(getRecentMessages("alice").length, 1);
  let calls = 0;
  const payloads: any[] = [];
  const search = createSearchService({
    apiKey: () => "synthetic",
    fetch: async (_url, init) => {
      calls++;
      payloads.push(JSON.parse(init!.body as string));
      await new Promise((r) => setTimeout(r, 5));
      return Response.json({
        results: [
          {
            title: "A",
            url: "https://example.com/?utm_source=x",
            content: "Useful evidence",
            score: 0.9,
          },
          { title: "duplicate", url: "https://example.com/", content: "same" },
          { title: "bad", url: "javascript:alert(1)", content: "bad" },
        ],
      });
    },
  });
  const [a, b] = await Promise.all([
    search({ query: "fixture", since: "2020-01-01" }),
    search({ query: "fixture", since: "2020-01-01" }),
  ]);
  assert.equal(calls, 1);
  assert.equal(a.results.length, 1);
  assert.equal(b.results[0].url, "https://example.com/");
  assert.equal(payloads[0].start_date, "2020-01-01");
  await search({ query: "fixture", since: "2020-01-01", maxResults: 1 });
  assert.equal(calls, 2);
  let tries = 0;
  const retry = createSearchService({
    apiKey: () => "synthetic",
    fetch: async () =>
      ++tries === 1
        ? new Response("", { status: 429 })
        : Response.json({ results: [] }),
  });
  await retry({ query: "rate" });
  assert.equal(tries, 2);
  const malformed = createSearchService({
    apiKey: () => "synthetic",
    fetch: async () => Response.json({ results: "bad" }),
  });
  assert.ok((await malformed({ query: "bad" })).error);
  let steps = 0,
    searches = 0;
  const model = new MockLanguageModelV1({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      stream: convertArrayToReadableStream<LanguageModelV1StreamPart>(
        ++steps === 1
          ? [
              {
                type: "tool-call",
                toolCallType: "function",
                toolCallId: "tool1",
                toolName: "web_search",
                args: JSON.stringify({ query: "fixture" }),
              },
              {
                type: "finish",
                finishReason: "tool-calls",
                usage: { promptTokens: 10, completionTokens: 5 },
              },
            ]
          : [
              {
                type: "text-delta",
                textDelta:
                  "Supported [A](https://example.com/). Fake [B](https://evil.example/).",
              },
              {
                type: "finish",
                finishReason: "stop",
                usage: { promptTokens: 20, completionTokens: 10 },
              },
            ],
      ),
    }),
  });
  const turn = runAgentTurn(
    {
      userId: "model-test",
      messages: [{ id: "untrusted", role: "user", content: "Find fixture" }],
    },
    {
      model,
      search: async () => {
        searches++;
        return a;
      },
    },
  );
  let output = "";
  for await (const chunk of turn.streamResult.textStream) output += chunk;
  assert.equal(searches, 1);
  assert.equal(steps, 2);
  assert.ok(output.includes("[A](https://example.com/)"));
  assert.ok(!output.includes("https://evil.example/"));
  const messages = getRecentMessages("model-test");
  assert.equal(messages.length, 2);
  assert.equal(messages[1].content, output);
  assert.equal(getSourcesForMessage(messages[1].id).length, 1);
  let directSearches = 0;
  const direct = new MockLanguageModelV1({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      stream: convertArrayToReadableStream<LanguageModelV1StreamPart>([
        { type: "text-delta", textDelta: "Paris." },
        {
          type: "finish",
          finishReason: "stop",
          usage: { promptTokens: 1, completionTokens: 1 },
        },
      ]),
    }),
  });
  const factual = runAgentTurn(
    {
      userId: "direct",
      messages: [{ id: "x", role: "user", content: "Capital of France?" }],
    },
    {
      model: direct,
      search: async () => {
        directSearches++;
        return a;
      },
    },
  );
  await factual.streamResult.consumeStream();
  assert.equal(directSearches, 0);
  let round = 0;
  const bounded = new MockLanguageModelV1({
    doStream: async (params) => {
      round++;
      const final = round === 3;
      if (final)
        assert.equal(
          params.mode.type === "regular" && params.mode.toolChoice?.type,
          "none",
        );
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: convertArrayToReadableStream<LanguageModelV1StreamPart>(
          final
            ? [
                {
                  type: "text-delta",
                  textDelta: "Partial answer: evidence is insufficient.",
                },
                {
                  type: "finish",
                  finishReason: "stop",
                  usage: { promptTokens: 1, completionTokens: 1 },
                },
              ]
            : [
                {
                  type: "tool-call",
                  toolCallType: "function",
                  toolCallId: `t${round}`,
                  toolName: "web_search",
                  args: JSON.stringify({ query: `round ${round}` }),
                },
                {
                  type: "finish",
                  finishReason: "tool-calls",
                  usage: { promptTokens: 1, completionTokens: 1 },
                },
              ],
        ),
      };
    },
  });
  const boundedTurn = runAgentTurn(
    {
      userId: "bounded",
      messages: [
        { id: "x", role: "user", content: "Research this thoroughly" },
      ],
    },
    { model: bounded, search: async () => ({ ...a, results: [] }) },
  );
  let boundedOutput = "";
  for await (const chunk of boundedTurn.streamResult.textStream)
    boundedOutput += chunk;
  assert.match(boundedOutput, /Partial answer/);
  assert.equal(round, 3);
  saveMessage({
    id: "pending",
    userId: "pending-test",
    role: "user",
    content: "never completed",
    status: "pending",
  });
  assert.equal(getRecentMessages("pending-test").length, 0);
  const owner = "12345678-1234-4234-8234-123456789012";
  saveMessage({
    id: "other-conversation",
    userId: `${owner}:12345678-1234-4234-8234-123456789013`,
    role: "user",
    content: "zebras are our topic",
    createdAt: "2026-11-03T12:00:00Z",
  });
  assert.equal(
    retrieveHistory(
      `${owner}:12345678-1234-4234-8234-123456789014`,
      "What did I ask about zebras on November 3?",
      { referenceDate: ref },
    ).turns.length,
    1,
  );
  assert.equal(
    retrieveHistory(
      "22345678-1234-4234-8234-123456789012:12345678-1234-4234-8234-123456789014",
      "What did I ask on November 3?",
      { referenceDate: ref },
    ).turns.length,
    0,
  );
  const bad = await POST(
    new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [], conversationId: "bad" }),
    }),
  );
  assert.equal(bad.status, 400);
  const huge = await POST(
    new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: "x".repeat(70000),
    }),
  );
  assert.equal(huge.status, 413);
  const reload = await GET(
    new NextRequest(
      "http://localhost/api/chat?conversationId=12345678-1234-4234-8234-123456789012",
    ),
  );
  assert.equal(reload.status, 200);
  assert.deepEqual((await reload.json()).messages, []);
  console.log(
    "Regression checks passed: sessions, ownership, DST, recall, transactions, search, actual SDK tool loop, citation stream/persistence, HTTP boundaries.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

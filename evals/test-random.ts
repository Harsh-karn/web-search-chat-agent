import { runAgentTurn } from "@/agent/loop";
import { randomUUID } from "node:crypto";

async function testQuery(label: string, question: string) {
  console.log(`\n========================================`);
  console.log(`[TEST]: ${label}`);
  console.log(`[QUERY]: "${question}"`);
  console.log(`========================================`);

  const userId = `eval-test-user-${randomUUID()}`;
  let toolCalled = false;

  const { streamResult } = runAgentTurn({
    userId,
    messages: [
      {
        id: randomUUID(),
        role: "user",
        content: question,
      },
    ],
    onToolCall: (q, since) => {
      toolCalled = true;
      console.log(`  -> [web_search called] query="${q}", since=${since || "none"}`);
    },
  });

  const reader = streamResult.toDataStreamResponse().body?.getReader();
  let fullText = "";
  if (reader) {
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value);
    }
  }

  console.log(`  -> Response length: ${fullText.length} bytes`);
  console.log(`  -> Tool called: ${toolCalled ? "YES" : "NO"}`);
  const textDeltas = [...fullText.matchAll(/0:"([^"]+)"/g)].map((m) => m[1]).join("");
  console.log(`  -> Text output preview:\n${textDeltas.slice(0, 300)}...`);
}

async function run() {
  // 1. General knowledge / math (should answer directly without web search)
  await testQuery("Math / Logic (Parametric)", "What is 15% of 240? Give just the number and one sentence explanation.");

  // 2. Fresh real-world web search query
  await testQuery("Live External Web Fact", "What is the latest stable version of Tailwind CSS released recently?");

  console.log("\nALL RANDOM QUERY TESTS COMPLETE! ✅");
}

run().catch(console.error);

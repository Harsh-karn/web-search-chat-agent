import assert from "node:assert";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function runDomAndLiveCheck() {
  console.log("==================================================");
  console.log(`DOM AND LIVE ENDPOINT VALIDATION (${BASE_URL})`);
  console.log("==================================================");

  // 1. Fetch HTML
  console.log(`Step 1: Fetching rendered HTML from ${BASE_URL}...`);
  const pageRes = await fetch(BASE_URL);
  assert.strictEqual(pageRes.status, 200, "Page status must be 200 OK");
  const html = await pageRes.text();
  console.log(`  Page received (${html.length} bytes).`);

  // 2. Validate DOM elements
  console.log("Step 2: Checking DOM elements and typography...");
  assert.ok(html.includes("Instrument+Serif"), "Must link Instrument Serif font");
  assert.ok(html.includes("Space+Grotesk"), "Must link Space Grotesk font");
  assert.ok(html.includes("Web Search Chat Agent"), "Must contain main agent title");
  assert.ok(html.includes("1 Tool: web_search"), "Must show single tool badge");
  assert.ok(html.includes("Seed Demo History"), "Must contain Seed Demo History button");
  assert.ok(html.includes("CRM Shortlist (Monday)"), "Must contain CRM test prompt chip");
  assert.ok(html.includes("Recall 3 November"), "Must contain Nov 3 test prompt chip");
  assert.ok(html.includes("Postgres Hosting (Last Tuesday)"), "Must contain Postgres test prompt chip");
  assert.ok(html.includes("Missing History Check"), "Must contain Missing History prompt chip");
  assert.ok(html.includes("<input"), "Must render chat input element");
  assert.ok(html.includes("<form"), "Must render chat form");
  console.log("  All DOM elements and design tokens verified! ✅");

  // 3. Test /api/seed endpoint
  console.log("Step 3: Testing /api/seed endpoint...");
  const testConversationId = "11111111-2222-3333-4444-555555555555";
  const seedRes = await fetch(`${BASE_URL}/api/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId: testConversationId }),
  });
  assert.strictEqual(seedRes.status, 200, "Seed endpoint must return 200");
  const seedJson = await seedRes.json();
  console.log("  Seed response:", seedJson);
  assert.strictEqual(seedJson.success, true, "Seed must return success: true");
  const rawCookie = seedRes.headers.get("set-cookie") || "";
  const cookie = rawCookie.split(";")[0];

  // 4. Test /api/chat endpoint with seeded session
  console.log("Step 4: Testing /api/chat streaming with seeded session...");
  const chatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie,
      "x-timezone": "UTC",
    },
    body: JSON.stringify({
      conversationId: testConversationId,
      messages: [
        {
          id: "test_dom_1",
          role: "user",
          content: "What did I ask you on 3 November? Is your answer still correct today?",
        },
      ],
    }),
  });

  assert.strictEqual(chatRes.status, 200, "/api/chat must return 200 OK stream");
  const streamReader = chatRes.body?.getReader();
  let fullStreamText = "";
  if (streamReader) {
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await streamReader.read();
      if (done) break;
      fullStreamText += decoder.decode(value);
    }
  }

  console.log(`  Stream completed (${fullStreamText.length} bytes).`);
  console.log("  Stream snippet:", fullStreamText.slice(0, 300).replace(/\n/g, " "));

  assert.ok(
    fullStreamText.toLowerCase().includes("postgres") ||
      fullStreamText.toLowerCase().includes("supabase") ||
      fullStreamText.toLowerCase().includes("neon"),
    "Stream must recall the 3 November Postgres discussion"
  );
  console.log("  Memory recall stream verified! ✅");

  console.log("\n==================================================");
  console.log("ALL DOM, DESIGN, SEEDING & STREAMING CHECKS PASSED! ✅");
  console.log("==================================================");
}

runDomAndLiveCheck().catch((err) => {
  console.error("DOM Check Failed:", err);
  process.exit(1);
});

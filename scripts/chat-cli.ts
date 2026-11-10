import readline from "node:readline";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env

import { runAgentTurn } from "../src/agent/loop";
import { Message } from "ai";

const userId = process.env.CLI_USER_ID || "cli_user";
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

console.log("==================================================");
console.log("⚡ WEB SEARCH CHAT AGENT — INTERACTIVE CLI");
console.log(`User ID: ${userId} | Timezone: ${tz}`);
console.log("Ask anything, recall past discussions, or type 'exit' to quit.");
console.log("==================================================\n");

const messages: Message[] = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt() {
  rl.question("\x1b[36mYou > \x1b[0m", async (input) => {
    const text = input.trim();
    if (!text) {
      prompt();
      return;
    }

    if (text.toLowerCase() === "exit" || text.toLowerCase() === "quit") {
      console.log("\nExiting chat. Goodbye!");
      rl.close();
      process.exit(0);
    }

    const userMessage: Message = {
      id: `cli_msg_${Date.now()}`,
      role: "user",
      content: text,
    };
    messages.push(userMessage);

    try {
      console.log("\x1b[90m[Agent thinking & checking temporal memory...]\x1b[0m");

      const { streamResult } = runAgentTurn({
        userId,
        messages,
        timezone: tz,
        onToolCall: (query, since) => {
          console.log(`\x1b[33m🔍 [Searching web]: "${query}"${since ? ` (since ${since})` : ""}\x1b[0m`);
        },
        onToolResult: (query, count) => {
          console.log(`\x1b[32m✅ [Results found]: ${count} sources for "${query}"\x1b[0m`);
        },
      });

      process.stdout.write("\x1b[34m\nAssistant > \x1b[0m");

      let fullResponse = "";
      for await (const chunk of streamResult.textStream) {
        process.stdout.write(chunk);
        fullResponse += chunk;
      }
      console.log("\n");

      messages.push({
        id: `cli_asst_${Date.now()}`,
        role: "assistant",
        content: fullResponse,
      });
    } catch (err) {
      console.error("\x1b[31mError during agent turn:\x1b[0m", err);
    }

    prompt();
  });
}

prompt();

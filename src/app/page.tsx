"use client";

import { useChat } from "ai/react";
import { useEffect, useState, useRef } from "react";
import { Send, Search, Clock, ShieldCheck, Sparkles, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";

export default function ChatPage() {
  const [clientTz, setClientTz] = useState<string>("UTC");
  const [currentDateStr, setCurrentDateStr] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setClientTz(tz);
      const now = new Date();
      setCurrentDateStr(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: tz,
        })
      );
    } catch {
      setClientTz("UTC");
    }
  }, []);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput, error } = useChat({
    api: "/api/chat",
    headers: {
      "x-timezone": clientTz,
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, error]);

  const testPrompts = [
    {
      title: "CRM Shortlist (Monday)",
      prompt: "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?",
    },
    {
      title: "Recall 3 November",
      prompt: "What did I ask you on 3 November? Is your answer still correct today?",
    },
    {
      title: "Postgres Hosting (Last Tuesday)",
      prompt: "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?",
    },
    {
      title: "Missing History Check",
      prompt: "What did I ask you on 14 October about Kubernetes clusters?",
    },
  ];

  return (
    <div className="flex flex-col h-screen max-w-5xl w-full mx-auto p-4 sm:p-6">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#1e2638]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              Web Search Chat Agent
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                1 Tool: web_search
              </span>
            </h1>
            <p className="text-xs text-gray-400">
              Deterministic temporal memory · Time-bounded search · Parallel execution
            </p>
          </div>
        </div>

        {/* Live Context Indicators */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#12161f] border border-[#1e2638] text-gray-300">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentDateStr || "Loading..."}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#12161f] border border-[#1e2638] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>TZ: {clientTz}</span>
          </div>
        </div>
      </header>

      {/* Quick Scenario Chips */}
      <div className="py-3 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
        <span className="text-gray-500 shrink-0 font-medium">Test Queries:</span>
        {testPrompts.map((item, idx) => (
          <button
            key={idx}
            onClick={() => setInput(item.prompt)}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#141a27] hover:bg-[#1a2233] text-gray-300 hover:text-white border border-[#222c42] transition-colors flex items-center gap-1.5"
          >
            <span>{item.title}</span>
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <main className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#141a27] border border-[#222c42] flex items-center justify-center text-blue-400">
              <Search className="w-6 h-6" />
            </div>
            <div className="max-w-md space-y-1">
              <h2 className="text-base font-medium text-gray-200">Ready to chat</h2>
              <p className="text-xs text-gray-400">
                Ask anything, recall prior discussions by date or day of the week, and verify what changed since.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${
                m.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-[#12161f] border border-[#1e2638] text-gray-200 shadow-sm"
                }`}
              >
                {/* Tool Invocations Status stream */}
                {m.toolInvocations && m.toolInvocations.length > 0 && (
                  <div className="mb-3 space-y-1.5 border-b border-[#1e2638]/80 pb-2">
                    {m.toolInvocations.map((tool) => (
                      <div
                        key={tool.toolCallId}
                        className="flex items-center gap-2 text-xs text-blue-300/90 bg-[#161c28] px-2.5 py-1 rounded-md border border-blue-500/20"
                      >
                        {tool.state === "result" ? (
                          <>
                            <Search className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>
                              Searched: <strong>{(tool.args as any)?.query}</strong>
                              {(tool.args as any)?.since ? ` (since ${(tool.args as any).since})` : ""}
                            </span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3 text-blue-400 animate-spin shrink-0" />
                            <span>
                              Searching: <strong>{(tool.args as any)?.query}</strong>...
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Content */}
                <div className="whitespace-pre-wrap font-normal">
                  {renderFormattedText(m.content)}
                </div>
              </div>
            </div>
          ))
        )}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-center gap-2 text-xs text-blue-400 px-3 py-2 bg-[#12161f] border border-[#1e2638] rounded-xl w-fit">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Analyzing time references and checking memory...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Error: {error.message || "Failed to communicate with the agent. Please check your API keys."}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Box */}
      <footer className="pt-3 border-t border-[#1e2638]">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a question or recall past decisions (e.g. 'Has any CRM tool changed pricing since Monday?')"
            disabled={isLoading}
            className="w-full bg-[#12161f] border border-[#1e2638] rounded-xl px-4 py-3 pr-12 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:hover:bg-blue-600 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}

// Minimal markdown link parser for citation links [Title](URL)
function renderFormattedText(text: string) {
  if (!text) return null;

  // Split by markdown link pattern [title](url)
  const linkRegex = /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [_, title, url] = match;
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-blue-400 hover:text-blue-300 underline underline-offset-2 mx-0.5 font-medium"
      >
        <span>{title}</span>
        <ExternalLink className="w-3 h-3 inline" />
      </a>
    );
    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

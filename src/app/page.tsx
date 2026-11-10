"use client";

import { useChat } from "ai/react";
import { useEffect, useState, useRef } from "react";
import {
  Send,
  Search,
  Clock,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Compass,
  ArrowUpRight,
} from "lucide-react";

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string>("");
  const [clientTz, setClientTz] = useState<string>("UTC");
  const [currentDateStr, setCurrentDateStr] = useState<string>("");
  const [hydrating, setHydrating] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = localStorage.getItem("conversationId") || crypto.randomUUID();
    localStorage.setItem("conversationId", id);
    setConversationId(id);
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
        }),
      );
    } catch {
      setClientTz("UTC");
    }
  }, []);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    setMessages,
    error,
  } = useChat({
    api: "/api/chat",
    body: { conversationId },
    headers: {
      "x-timezone": clientTz,
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, error]);

  useEffect(() => {
    if (!conversationId) return;
    setHydrating(true);
    const controller = new AbortController();
    fetch(`/api/chat?conversationId=${conversationId}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setMessages(data.messages);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setHydrating(false);
      });
    return () => controller.abort();
  }, [conversationId, setMessages]);

  const testPrompts = [
    {
      title: "CRM Shortlist (Monday)",
      tag: "Recall & Parallel Search",
      prompt:
        "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?",
    },
    {
      title: "Recall 3 November",
      tag: "Time-Bound Recheck",
      prompt:
        "What did I ask you on 3 November? Is your answer still correct today?",
    },
    {
      title: "Postgres Hosting (Last Tuesday)",
      tag: "Relative Date Resolution",
      prompt:
        "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?",
    },
    {
      title: "Missing History Check",
      tag: "Epistemic Honesty",
      prompt: "What did I ask you on 14 October about Kubernetes clusters?",
    },
  ];

  return (
    <div className="flex flex-col h-screen max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      {/* Editorial Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[rgba(120,53,15,0.18)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="label-tag text-[#c2410c] tracking-[0.25em]">
              Autonomous Search Agent
            </span>
            <span className="text-[0.65rem] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full bg-[#c2410c]/10 text-[#c2410c] font-semibold border border-[#c2410c]/20">
              1 Tool: web_search
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#1c1917] tracking-tight">
            Web Search Chat Agent{" "}
            <span className="italic font-normal text-[#b45309]">
              with Temporal Memory
            </span>
          </h1>
          <p className="text-xs text-[#78350f]/80 font-sans mt-0.5">
            Harness-side deterministic memory · Parallel tool calling ·
            Epistemic honesty
          </p>
        </div>

        {/* Live Context Indicators & Seed Button */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <button
            onClick={() => {
              const id = crypto.randomUUID();
              localStorage.setItem("conversationId", id);
              setMessages([]);
              setConversationId(id);
            }}
            disabled={isLoading || hydrating}
            className="px-3 py-2 border rounded-lg"
          >
            New conversation
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(255,251,235,0.85)] border border-[rgba(120,53,15,0.22)] text-[#44403c] font-medium shadow-xs">
            <Clock className="w-3.5 h-3.5 text-[#b45309]" />
            <span>{currentDateStr || "Loading..."}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(255,251,235,0.85)] border border-[rgba(120,53,15,0.22)] text-[#78350f] font-medium shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#c2410c]" />
            <span>TZ: {clientTz}</span>
          </div>
        </div>
      </header>

      {/* Seed Success Banner */}
      {/* Test Scenarios Ribbon */}
      <div className="py-3 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
        <span className="label-tag text-[#78350f] shrink-0 pr-1">
          Evaluation Prompts:
        </span>
        {testPrompts.map((item, idx) => (
          <button
            key={idx}
            onClick={() => setInput(item.prompt)}
            className="shrink-0 px-3.5 py-1.5 rounded-full bg-[rgba(255,251,235,0.8)] hover:bg-[#fffbeb] text-[#292524] hover:text-[#c2410c] border border-[rgba(120,53,15,0.2)] hover:border-[#c2410c]/50 transition-all flex items-center gap-2 cursor-pointer shadow-2xs group"
          >
            <span className="font-medium">{item.title}</span>
            <span className="text-[0.65rem] text-[#b45309] font-sans opacity-70 group-hover:opacity-100">
              · {item.tag}
            </span>
            <ArrowUpRight className="w-3 h-3 text-[#b45309] opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        ))}
      </div>

      {/* Main Conversation Log */}
      <main className="flex-1 overflow-y-auto space-y-5 py-4 pr-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(255,251,235,0.9)] border border-[rgba(120,53,15,0.25)] flex items-center justify-center text-[#c2410c] shadow-sm">
              <Compass className="w-7 h-7" />
            </div>
            <div className="max-w-lg space-y-2">
              <h2 className="text-2xl font-serif text-[#1c1917] tracking-tight">
                Answering fast, getting facts right, and good to talk to.
              </h2>
              <p className="text-xs text-[#78350f]/80 leading-relaxed font-sans max-w-md mx-auto">
                Equipped with a single time-aware{" "}
                <code className="px-1.5 py-0.5 rounded bg-[rgba(120,53,15,0.08)] text-[#c2410c] font-mono text-[0.75rem]">
                  web_search
                </code>{" "}
                tool. Time and memory are resolved deterministically before the
                model runs.
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full text-left pt-2">
              <div className="index-card p-4">
                <span className="label-tag text-[#c2410c] block mb-1">
                  01 / Temporal
                </span>
                <h3 className="font-serif text-base text-[#1c1917] font-semibold">
                  Deterministic Resolution
                </h3>
                <p className="text-xs text-[#78350f]/80 mt-1">
                  Resolves relative dates (&quot;Monday&quot;, &quot;last
                  Tuesday&quot;) against client timezones before LLM invocation.
                </p>
              </div>
              <div className="index-card p-4">
                <span className="label-tag text-[#b45309] block mb-1">
                  02 / Memory
                </span>
                <h3 className="font-serif text-base text-[#1c1917] font-semibold">
                  Zero-Tool Recall
                </h3>
                <p className="text-xs text-[#78350f]/80 mt-1">
                  Stored in local SQLite (
                  <code className="text-[0.7rem] font-mono">node:sqlite</code>).
                  Recalls bounded conversation history and stored evidence.
                </p>
              </div>
              <div className="index-card p-4">
                <span className="label-tag text-[#c2410c] block mb-1">
                  03 / Honesty
                </span>
                <h3 className="font-serif text-base text-[#1c1917] font-semibold">
                  Epistemic Truth
                </h3>
                <p className="text-xs text-[#78350f]/80 mt-1">
                  Strictly distinguishes: no prior history vs. searched and no
                  change vs. no sources found.
                </p>
              </div>
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
                className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed transition-all ${
                  m.role === "user"
                    ? "bg-[#1c1917] text-[#fffbeb] shadow-sm font-sans"
                    : "index-card text-[#292524] shadow-sm font-sans"
                }`}
              >
                {/* Tool Invocations Status stream */}
                {m.toolInvocations && m.toolInvocations.length > 0 && (
                  <div className="mb-3.5 space-y-2 border-b border-[rgba(120,53,15,0.18)] pb-3">
                    {m.toolInvocations.map((tool) => (
                      <div
                        key={tool.toolCallId}
                        className="flex items-center gap-2 text-xs text-[#78350f] bg-[rgba(255,251,235,0.9)] px-3 py-1.5 rounded-lg border border-[rgba(120,53,15,0.22)] shadow-2xs font-mono"
                      >
                        {tool.state === "result" ? (
                          <>
                            <Search className="w-3.5 h-3.5 text-[#c2410c] shrink-0" />
                            <span>
                              Searched:{" "}
                              <strong className="text-[#1c1917]">
                                {(tool.args as any)?.query}
                              </strong>
                              {(tool.args as any)?.since
                                ? ` (since ${(tool.args as any).since})`
                                : ""}
                            </span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 text-[#b45309] animate-spin shrink-0" />
                            <span>
                              Searching:{" "}
                              <strong className="text-[#1c1917]">
                                {(tool.args as any)?.query}
                              </strong>
                              ...
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Content with rich Markdown formatting */}
                <div className="font-normal text-[0.93rem] leading-relaxed">
                  {renderFormattedContent(m.content)}
                </div>
              </div>
            </div>
          ))
        )}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-center gap-2.5 text-xs text-[#c2410c] px-4 py-2.5 bg-[rgba(255,251,235,0.95)] border border-[rgba(194,65,12,0.3)] rounded-full w-fit shadow-xs font-medium">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#c2410c]" />
            <span>Resolving time context and querying memory...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Error:{" "}
              {error.message ||
                "Failed to communicate with the agent. Please check your API keys."}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Editorial Input Box */}
      <footer className="pt-3 border-t border-[rgba(120,53,15,0.18)]">
        <form
          onSubmit={(event) => {
            if (hydrating) {
              event.preventDefault();
              return;
            }
            handleSubmit(event);
          }}
          className="relative flex items-center"
        >
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a question or recall past decisions (e.g. 'Has any CRM tool changed pricing since Monday?')"
            disabled={isLoading || hydrating}
            className="w-full bg-[rgba(255,251,235,0.9)] border border-[rgba(120,53,15,0.25)] rounded-2xl px-5 py-3.5 pr-14 text-sm text-[#1c1917] placeholder-[#78350f]/50 focus:outline-none focus:border-[#c2410c] focus:ring-1 focus:ring-[#c2410c]/30 transition-all font-sans shadow-xs"
          />
          <button
            type="submit"
            disabled={
              isLoading || hydrating || !conversationId || !input.trim()
            }
            className="absolute right-2 p-2.5 rounded-xl bg-[#1c1917] hover:bg-[#c2410c] text-[#fffbeb] disabled:opacity-30 disabled:hover:bg-[#1c1917] transition-all cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}

// Markdown parser supporting tables, links, bold, and code
function renderFormattedContent(text: string) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    const rows = tableBuffer
      .map((row) => row.trim())
      .filter((row) => row.startsWith("|") && row.endsWith("|"))
      .map((row) =>
        row
          .slice(1, -1)
          .split("|")
          .map((cell) => cell.trim()),
      );

    if (rows.length >= 2) {
      const headerRow = rows[0];
      const dataRows = rows
        .slice(1)
        .filter((r) => !r.every((c) => /^[-:]+$/.test(c)));

      elements.push(
        <div
          key={`tbl_${elements.length}`}
          className="overflow-x-auto my-3 rounded-xl border border-[rgba(120,53,15,0.2)] bg-[rgba(255,251,235,0.6)] shadow-2xs"
        >
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-[rgba(120,53,15,0.2)] bg-[rgba(120,53,15,0.06)]">
                {headerRow.map((cell, i) => (
                  <th
                    key={i}
                    className="py-2.5 px-3.5 font-semibold text-[#1c1917] tracking-wider font-sans"
                  >
                    {parseInlineMarkdown(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(120,53,15,0.1)]">
              {dataRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="hover:bg-[rgba(194,65,12,0.04)] transition-colors"
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="py-2.5 px-3.5 text-[#292524] font-sans"
                    >
                      {parseInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }
    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      tableBuffer.push(line);
    } else {
      flushTable();
      elements.push(
        <p key={i} className="min-h-[1.25rem]">
          {parseInlineMarkdown(line)}
        </p>,
      );
    }
  }
  flushTable();

  return <div className="space-y-1.5">{elements}</div>;
}

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const regex = /\[(.*?)\]\((https?:\/\/[^\s)]+)\)|\*\*(.*?)\*\*|`(.*?)`/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      // Citation Link [Title](URL)
      parts.push(
        <a
          key={`lnk_${match.index}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[#c2410c] hover:text-[#9a3412] underline decoration-1 underline-offset-2 mx-0.5 font-medium transition-colors"
        >
          <span>{match[1]}</span>
          <ExternalLink className="w-3 h-3 inline text-[#b45309]" />
        </a>,
      );
    } else if (match[3] !== undefined) {
      // Bold **text**
      parts.push(
        <strong
          key={`bld_${match.index}`}
          className="font-semibold text-[#1c1917]"
        >
          {match[3]}
        </strong>,
      );
    } else if (match[4] !== undefined) {
      // Inline Code `code`
      parts.push(
        <code
          key={`code_${match.index}`}
          className="px-1.5 py-0.5 rounded bg-[rgba(120,53,15,0.08)] text-[#c2410c] font-mono text-[0.78rem]"
        >
          {match[4]}
        </code>,
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

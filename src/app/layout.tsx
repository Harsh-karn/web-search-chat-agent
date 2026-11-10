import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Search Agent | Time-Aware Web Search Chat Agent",
  description: "Chat agent with a single time-bounded web search tool and temporal conversation memory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0a0c10] text-gray-100 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}

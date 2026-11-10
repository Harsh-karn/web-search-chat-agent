import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Search Agent | Time-Aware Web Search Chat Agent",
  description: "High-performance chat agent with a single time-bounded web search tool and temporal conversation memory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-[#fffbeb] text-[#292524] min-h-screen flex flex-col font-sans selection:bg-[#c2410c] selection:text-[#fffbeb]">
        {children}
      </body>
    </html>
  );
}

import { canonicalUrl } from "./search";
export function validateLinks(text: string, urls: Set<string>) {
  return text.replace(
    /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, title: string, url: string) => {
      const canonical = canonicalUrl(url);
      return canonical && urls.has(canonical)
        ? `[${title}](${canonical})`
        : `${title} [unverified source omitted]`;
    },
  );
}
export function citedUrls(text: string) {
  return new Set(
    [...text.matchAll(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)]
      .map((m) => canonicalUrl(m[1]))
      .filter((u): u is string => !!u),
  );
}

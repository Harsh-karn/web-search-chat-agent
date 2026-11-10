export interface SearchResultItem {
  title: string;
  url: string;
  publishedDate?: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  since?: string;
  cached: boolean;
  results: SearchResultItem[];
  error?: string;
}

// 検索結果を表す型
export interface SearchResult {
  body: string;
  line: number;
  number: string;
  subtitle: string;
  url: string;
  episodeId: bigint;
}
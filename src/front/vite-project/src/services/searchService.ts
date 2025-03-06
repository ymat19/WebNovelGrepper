import { SearchResult } from "../types";
import { WebSiteConfig, Record } from "../types";

export const search = async (
  commaSeparatedQuery: string,
  config: WebSiteConfig,
  getRecords: (
    commaSeparatedQuery: string,
    config: WebSiteConfig
  ) => Promise<Record[]>
): Promise<SearchResult[]> => {
  const records = await getRecords(commaSeparatedQuery, config);
  const padding = 2;
  return records.map((record) => {
    return {
      body: record.body,
      line: record.line,
      number: record.number,
      subtitle: record.sub_title,
      url:
        config.getEpisodeUrl(record.episode_id) +
        `#p${record.line < padding ? record.line : record.line - padding}`,
      episodeId: BigInt(record.episode_id),
    };
  });
};

export const createQueryString = (query: string): string =>
  query.replace(/[\u3000\s]/g, ",");

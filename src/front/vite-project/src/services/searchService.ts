import { SearchResult } from "../types";
import { WebSiteConfig ,Record, WorkUrlParser } from "../types";

export const search = async (
  commaSeparatedQuery: string,
  config : WebSiteConfig,
  getRecords: (commaSeparatedQuery: string, parser: WorkUrlParser, config: WebSiteConfig) => Promise<Record[]>
): Promise<SearchResult[]> => {
  // 結局複数作品に対応してないので一番目を取る
  const workUrlParser = config.workUrlParsers[0];
  const records = await getRecords(commaSeparatedQuery, workUrlParser, config);
  const padding = 2;
  return records.map((record) => {
    return {
      body: record.body,
      line: record.line,
      number: record.number,
      subtitle: record.sub_title,
      url:
        workUrlParser.getEpisodeUrl(record.episode_id) +
        `#p${record.line < padding ? record.line : record.line - padding}`,
      episodeId: BigInt(record.episode_id),
    };
  });
};

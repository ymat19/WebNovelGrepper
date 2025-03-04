import { FrontConfig, ParsedConfig } from "../types";

export const getConfig = async (): Promise<ParsedConfig> => {
  const response = await fetch(
    `${
      import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL
    }/front_config.json`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  const frontConfig: FrontConfig = await response.json();

  return configFactory(frontConfig);
};

const configFactory = ( config: FrontConfig ) => {
  return {
    ...config,
    workUrlParsers: config.work_urls.split(",").map((url) => {
      return {
        workId: url.split("/").reverse()[2],
        getEpisodeUrl: (episodeId: string) =>
          url.split("/episodes/")[0] + `/episodes/${episodeId}`,
      };
    }),
  };
}
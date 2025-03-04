import { RawConfig, WebSiteConfig } from "../types";

export const getConfig = async (): Promise<WebSiteConfig> => {
  const response = await fetch(
    `${
      import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL
    }/front_config.json`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  const frontConfig: RawConfig = await response.json();

  return configFactory(frontConfig);
};

const configFactory = ( config: RawConfig ) => {
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

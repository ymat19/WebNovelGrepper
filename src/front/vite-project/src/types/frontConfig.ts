// json設定ファイルの型定義
export interface RawConfig {
  api_endpoint_url: string;
  work_urls: string;
  title: string;
  license_notice: string;
  about: string;
  technology_about: string;
  contact_email: string;
  contact_x: string;
}

// stateで持っておく設定値
export interface WebSiteConfig extends RawConfig {
  workId: string;
  getEpisodeUrl: (episodeId: string) => string;
}

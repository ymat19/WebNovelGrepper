import { describe, test, expect, vi, beforeAll, afterEach, Mock } from "vitest";
import { getConfig } from "./configService";
import { RawConfig } from "../types";

describe("getConfig", () => {
  // fetch をグローバルスコープでモック化する
  beforeAll(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("fetch が成功した場合、正しい config を返す", async () => {
    const mockRawConfig: RawConfig = {
      work_urls: "https://example.com/works/12345/episodes/67890",
      // 他に必要なフィールドがあれば適宜追加
      api_endpoint_url: "",
      title: "",
      license_notice: "",
      about: "",
      technology_about: "",
      contact_email: "",
      contact_x: "",
    };

    // fetch をモックして、成功したレスポンスを返すように設定
    (global.fetch as unknown as Mock).mockResolvedValue({
      ok: true,
      json: async () => mockRawConfig,
    });

    // テスト対象関数を呼び出す
    const config = await getConfig();

    // 返却値の検証
    expect(config.work_urls).toBe(mockRawConfig.work_urls);
    expect(config.workId).toBe("12345");
    // getEpisodeUrl の動作を確認
    expect(config.getEpisodeUrl("99999")).toBe(
      "https://example.com/works/12345/episodes/99999"
    );
  });

  test("fetch が失敗した場合、エラーを投げる", async () => {
    (global.fetch as unknown as Mock).mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    });

    await expect(getConfig()).rejects.toThrow("Failed to fetch: Not Found");
  });
});

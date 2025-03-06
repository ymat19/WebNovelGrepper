import { describe, it, expect, vi } from "vitest";
import { search, createQueryString } from "./searchService";
import type { WebSiteConfig, Record, SearchResult } from "../types";

// ダミーのWebSiteConfigを用意
const mockConfig: WebSiteConfig = {
  getEpisodeUrl: (episodeId: string) =>
    `https://example.com/episodes/${episodeId}`,
  workId: "",
  api_endpoint_url: "",
  work_urls: "",
  title: "",
  license_notice: "",
  about: "",
  technology_about: "",
  contact_email: "",
  contact_x: "",
};

// ダミーのRecordデータを返すモック関数を用意
const mockGetRecords = vi.fn();

describe("search function", () => {
  it("should return an array of SearchResult with correct fields", async () => {
    // モックが返すRecord配列を定義
    const mockRecords: Record[] = [
      {
        body: "test body 1",
        line: 1,
        number: "101",
        sub_title: "sub1",
        episode_id: "10",
        work_id: "12345",
      },
      {
        body: "test body 2",
        line: 5,
        number: "102",
        sub_title: "sub2",
        episode_id: "11",
        work_id: "12345",
      },
    ];

    // モックの戻り値をセット
    mockGetRecords.mockResolvedValueOnce(mockRecords);

    // 実行
    const result: SearchResult[] = await search(
      "test,query",
      mockConfig,
      mockGetRecords
    );

    // getRecords が正しい引数で呼ばれたかを検証
    expect(mockGetRecords).toHaveBeenCalledWith("test,query", mockConfig);

    // 返却された SearchResult[] の検証
    expect(result.length).toBe(2);

    // 1つめの要素の検証
    expect(result[0]).toEqual({
      body: "test body 1",
      line: 1,
      number: "101",
      subtitle: "sub1",
      url: "https://example.com/episodes/10#p1", // line < padding(2)のためそのまま1
      episodeId: BigInt(10),
    });
    // 2つめの要素の検証
    expect(result[1]).toEqual({
      body: "test body 2",
      line: 5,
      number: "102",
      subtitle: "sub2",
      url: "https://example.com/episodes/11#p3", // line(5) > padding(2)なので line - padding => 3
      episodeId: BigInt(11),
    });
  });

  it("should return an empty array when getRecords returns an empty array", async () => {
    mockGetRecords.mockResolvedValueOnce([]);

    const result = await search("test,query", mockConfig, mockGetRecords);

    expect(result).toEqual([]);
  });
});

describe("createQueryString function", () => {
  it("should replace all full-width and half-width spaces with commas", () => {
    // 全角スペース、半角スペースが混じった文字列
    const input = "Hello　World  Test";
    // createQueryString を適用すると全てカンマに変換
    const output = createQueryString(input);
    expect(output).toBe("Hello,World,,Test");
  });

  it("should return the same string if there are no spaces", () => {
    const input = "HelloWorld";
    const output = createQueryString(input);
    expect(output).toBe("HelloWorld");
  });
});

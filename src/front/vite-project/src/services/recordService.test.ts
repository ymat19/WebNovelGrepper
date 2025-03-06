import {
  describe,
  test,
  expect,
  vi,
  beforeEach,
  afterEach,
  Mock,
} from "vitest";

import { getRecords } from "./recordService";
import { WebSiteConfig, Record } from "../types";
import * as CryptoJS from "crypto-js";

/**
 * テストで使うダミーの WebSiteConfig
 */
const dummyConfig: WebSiteConfig = {
  workId: "12345",
  api_endpoint_url: "https://api.example.com/search",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getEpisodeUrl: (_: string) => "",
  work_urls: "",
  title: "",
  license_notice: "",
  about: "",
  technology_about: "",
  contact_email: "",
  contact_x: "",
};

/**
 * 便利関数: fetch の戻り値をモックする
 * @param responses mockResolvedValueOnce で順番に返すデータの配列
 */
function mockFetchSequence(
  responses: Array<Partial<Response> & { json?: () => unknown }>
) {
  (global.fetch as Mock).mockReset();
  responses.forEach((res) => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: res.ok ?? true,
      status: res.status ?? 200,
      statusText: res.statusText ?? "OK",
      json: res.json ?? (async () => ({})),
    });
  });
}

function createDummyRecord(body: string): Record {
  return {
    body: body,
    work_id: "",
    sub_title: "",
    number: "",
    episode_id: "",
    line: 0,
  };
}

describe("getRecords (stub mode / demo mode)", () => {
  const getRecordsOnDemo = getRecords(() => true);
  // テスト前後で fetch をモック
  beforeEach(() => {
    // 型を満たすために一旦 unknown を経由してキャスト
    global.fetch = vi.fn() as unknown as typeof global.fetch;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("records.json を取得し、クエリにマッチするレコードのみを返す", async () => {
    const mockRecords: Record[] = [
      createDummyRecord("Hello world"),
      createDummyRecord("Sample text"),
      createDummyRecord("Hello vi"),
    ];
    // fetch 呼び出し 1 回目で records.json のモックレスポンスを返す
    mockFetchSequence([
      {
        json: async () => mockRecords,
      },
    ]);

    // カンマ区切りクエリ = "Hello,vi"
    const result = await getRecordsOnDemo("Hello,vi", dummyConfig);

    // 期待: body に "Hello" か "vi" を含むレコードだけ返る
    expect(result).toEqual([
      createDummyRecord("Hello world"),
      createDummyRecord("Hello vi"),
    ]);

    // fetch が正しい URL を呼んだか
    expect(global.fetch).toHaveBeenCalledWith(
      `${import.meta.env.BASE_URL}/records.json`
    );
  });

  test("fetch がエラー (ok=false) のときは空配列を返す", async () => {
    mockFetchSequence([
      {
        ok: false,
        statusText: "Not Found",
      },
    ]);

    const result = await getRecordsOnDemo("anyQuery", dummyConfig);
    expect(result).toEqual([]);
  });
});

describe("getRecords (AWS mode / production mode)", () => {
  const getRecordsOnAWS = getRecords(() => false);
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof global.fetch;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("キャッシュがヒットした場合、そのまま結果を返す", async () => {
    const mockCache: Record[] = [
      createDummyRecord("cached data"),
      createDummyRecord("some more cached data"),
    ];

    // 1回目の fetch が cache fetch → ok=true & mockCache を返す
    mockFetchSequence([
      {
        ok: true,
        json: async () => mockCache,
      },
    ]);

    const query = "hello,world";
    const hash = CryptoJS.SHA256(query).toString(CryptoJS.enc.Hex);

    const result = await getRecordsOnAWS("hello,world", dummyConfig);
    expect(result).toEqual(mockCache);

    // 1回だけキャッシュ取得
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `cache/${dummyConfig.workId}/${hash}.json`
    );
  });

  test("キャッシュがない場合、api_endpoint_url にクエリを投げて結果を返す (ok=true)", async () => {
    const mockAPIResponse: Record[] = [createDummyRecord("API result")];

    // 1回目: キャッシュ → 404
    // 2回目: 本API → ok=true & mockAPIResponse
    mockFetchSequence([
      {
        ok: false,
        status: 404,
        statusText: "Not Found",
      },
      {
        ok: true,
        json: async () => mockAPIResponse,
      },
    ]);

    const query = "hello,world";
    const result = await getRecordsOnAWS(query, dummyConfig);
    expect(result).toEqual(mockAPIResponse);

    // 2回 fetch 呼ばれる
    expect(global.fetch).toHaveBeenCalledTimes(2);
    // 1回目: キャッシュURL
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^cache\/12345\/.+\.json$/)
    );
    // 2回目: クエリ送信
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      `${dummyConfig.api_endpoint_url}?work_id=${dummyConfig.workId}&words=${query}`
    );
  });

  test("503 の場合にリトライしてキャッシュを再チェックし、ヒットすれば返す", async () => {
    const mockCache: Record[] = [createDummyRecord("cached after retry")];

    // 1回目: キャッシュ → 404 (not found)
    // 2回目: クエリ送信 → 503
    // リトライ: その後キャッシュ fetch → ok=true & mockCache を返すようにする
    mockFetchSequence([
      {
        ok: false,
        status: 404,
      },
      {
        ok: false,
        status: 503,
      },
      // リトライ1回目～(N回目)でキャッシュOKを返す想定 (ここでは1回で成功する例)
      {
        ok: true,
        json: async () => mockCache,
      },
    ]);

    const result = await getRecordsOnAWS("any,query", dummyConfig, 0);

    expect(result).toEqual(mockCache);

    // fetch 呼び出し回数は最低3回:
    // 1. キャッシュチェック
    // 2. クエリ送信 (503)
    // 3. リトライ後キャッシュチェック (OK)
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

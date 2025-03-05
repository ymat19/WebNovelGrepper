import { WebSiteConfig, Record} from "../types";
import * as CryptoJS from "crypto-js";

const getRecordsFromStub = async (
  commaSeparatedQuery: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config: WebSiteConfig
): Promise<Record[]> => {
  const queries = commaSeparatedQuery.split(",");

  const queryResponse = await fetch(`${import.meta.env.BASE_URL}/records.json`);
  if (queryResponse.ok) {
    const allRecords = await queryResponse.json();
    return allRecords.filter((record: Record) =>
      queries.some((query) => record.body.includes(query))
    );
  } else {
    console.error(`Failed to fetch: ${queryResponse.statusText}`);
  }

  return [];
};

const getRecordsFromAWS = async (
  commaSeparatedQuery: string,
  config: WebSiteConfig,
  retryInterval = 5000
): Promise<Record[]> => {
  const hash = CryptoJS.SHA256(commaSeparatedQuery).toString(CryptoJS.enc.Hex);

  // キャッシュ取得
  const getCache = async (hash: string): Promise<[boolean, Record[]]> => {
    try {
      const cacheResponse = await fetch(`cache/${config.workId}/${hash}.json`);
      if (cacheResponse.ok) {
        return [true, await cacheResponse.json()];
      } else if (cacheResponse.status === 404 || cacheResponse.status === 403) {
        // キャッシュが存在しない 本来404だが、Cloud Frontが403を返す
        return [false, []];
      } else {
        throw new Error(`Failed to fetch: ${cacheResponse.statusText}`);
      }
    } catch (err) {
      // ローカルデバッグだとエラーのhtmlが返ってきてSyntaxError
      // Safariだとinstanceofがfalseになる
      const errObj = err as Error;
      if (err instanceof SyntaxError || errObj.name === "SyntaxError") return [false, []];
      throw err;
    }
  };

  // 最初にキャッシュチェック あれば終わり
  const [hit, cache] = await getCache(hash);
  if (hit) return cache;

  // キャッシュがない場合 クエリを投げる
  const queryResponse = await fetch(
    `${config?.api_endpoint_url}?work_id=${config.workId}&words=${commaSeparatedQuery}`
  );

  if (queryResponse.ok) {
    return await queryResponse.json();
  } else if (queryResponse.status === 503) {
    // 503系はタイムアウトだが、lambdaは走りっぱなしなので、リトライでキャッシュを回収しに行く
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of Array(10).keys()) {
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
      const [hit, cache] = await getCache(hash);
      if (hit) return cache;
    }
  }

  // リトライしてもダメだった場合
  return [];
};

export const getRecords = (isDemoMode: () => boolean) =>
  isDemoMode() ? getRecordsFromStub : getRecordsFromAWS;

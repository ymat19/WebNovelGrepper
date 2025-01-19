import {
  Box,
  Container,
  Flex,
  Spinner,
} from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import SearchForm from "./components/SearchForm";
import { SearchResults, SearchResult } from "./components/SearchResults";
import { RequestDialog } from "./components/RequestDialog";
import { AboutDialog } from "./components/AboutDialog";
import * as CryptoJS from "crypto-js";

// 作品URLを作ったりする
interface WorkUrlParser {
  workId: string;
  getEpisodeUrl: (episodeId: string) => string;
}

// stateで持っておく設定値
interface ParsedConfig extends FrontConfig {
  workUrlParsers: WorkUrlParser[];
}

// フロントエンドの設定のjson定義
interface FrontConfig {
  api_endpoint_url: string;
  work_urls: string;
  title: string;
  license_notice: string;
  about: string;
  technology_about: string;
  contact_email: string;
  contact_x: string;
}

// バックエンドから返ってくるレスポンスの型
interface Record {
  work_id: string;
  sub_title: string;
  number: string;
  episode_id: string;
  line: number;
  body: string;
}

const App: React.FC = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [config, setConfig] = useState<ParsedConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const diagButtonRef = useRef<HTMLButtonElement | null>(null);
  
  console.log(import.meta.env.MODE);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL}/front_config.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        const frontConfig: FrontConfig = await response.json();
        setConfig({
          ...frontConfig,
          workUrlParsers: frontConfig.work_urls.split(",").map((url) => {
            return {
              workId: url.split("/").reverse()[2],
              getEpisodeUrl: (episodeId: string) =>
                url.split("/episodes/")[0] + `/episodes/${episodeId}`,
            };
          }),
        });

        document.title = frontConfig.title;
      } catch (err) {
        console.error(err);
      }
    };
    loadConfig();
  }, []);

  const getRecords = async (
    query: string,
    parser: WorkUrlParser
  ): Promise<Record[]> => {
    const commaSeparatedQuery = query.replace(/[\u3000\s]/g, ",");
    setQuery(commaSeparatedQuery);

    const hash = CryptoJS.SHA256(commaSeparatedQuery).toString(
      CryptoJS.enc.Hex
    );

    // キャッシュ取得
    const getCache = async (hash: string): Promise<[boolean, Record[]]> => {
      try {
        const cacheResponse = await fetch(
          `cache/${parser.workId}/${hash}.json`
        );
        if (cacheResponse.ok) {
          return [true, await cacheResponse.json()];
        } else if (
          cacheResponse.status === 404 ||
          cacheResponse.status === 403
        ) {
          // キャッシュが存在しない 本来404だが、Cloud Frontが403を返す
          return [false, []];
        } else {
          throw new Error(`Failed to fetch: ${cacheResponse.statusText}`);
        }
      } catch (err) {
        // ローカルデバッグだと別ファイルをとってきて SyntaxError
        if (err instanceof SyntaxError) return [false, []];
        throw err;
      }
    };

    // 最初にキャッシュチェック あれば終わり
    const [hit, cache] = await getCache(hash);
    if (hit) return cache;

    // キャッシュがない場合 クエリを投げる
    const queryResponse = await fetch(
      `${config?.api_endpoint_url}?work_id=${parser.workId}&words=${commaSeparatedQuery}`
    );

    if (queryResponse.ok) {
      return await queryResponse.json();
    } else if (queryResponse.status === 503) {
      // 503系はタイムアウトだが、lambdaは走りっぱなしなので、リトライでキャッシュを回収しに行く
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ of Array(10).keys()) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const [hit, cache] = await getCache(hash);
        if (hit) return cache;
      }
    }

    // リトライしてもダメだった場合
    return [];
  };

  const handleSearch = async (query: string) => {
    try {
      if (!config) {
        return;
      }
      setIsLoading(true);

      const workUrlParser = config.workUrlParsers[0];
      const records = await getRecords(query, workUrlParser);
      const padding = 2;
      const results: SearchResult[] = records.map((record) => {
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

      setResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box minH="100vh" bg="#E3E8EB">
      <Header
        title={config?.title || ""}
        onClickAbout={() => diagButtonRef.current?.click()}
      />
      <Container maxW="container.md" mt={8}>
        <SearchForm onSearch={handleSearch} />
        <SearchResults
          results={results}
          query={query}
          license_notice={config?.license_notice || ""}
        />
        <RequestDialog endpoint={`${config?.api_endpoint_url}`} ></RequestDialog>
      </Container>
      {isLoading && (
        <Flex
          position="fixed"
          top="0"
          left="0"
          width="100vw"
          height="100vh"
          backgroundColor="rgba(0, 0, 0, 0.5)" // 半透明の背景
          align="center"
          justify="center"
          zIndex="overlay" // Chakra UI の z-index 値を利用
        >
          <Spinner size="xl" color="white" />
        </Flex>
      )}
      <AboutDialog
        buttonRef={diagButtonRef}
        about={config?.about || ""}
        technology_about={config?.technology_about || ""}
        contact_email={config?.contact_email || ""}
        contact_x={config?.contact_x || ""}>
      </AboutDialog>
    </Box>
  );
};

export default App;

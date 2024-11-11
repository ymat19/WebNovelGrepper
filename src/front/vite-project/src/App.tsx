import {
  Box,
  Button,
  Container,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  Flex,
  Heading,
  Link,
  Portal,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import SearchForm from "./components/SearchForm";
import { SearchResults, SearchResult } from "./components/SearchResults";
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
  const diagButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("front_config.json");
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

    const hash = CryptoJS.SHA256(commaSeparatedQuery).toString(
      CryptoJS.enc.Hex
    );

    // キャッシュ取得
    const getCache = async (hash: string): Promise<Record[]> => {
      try {
        const cacheResponse = await fetch(
          `cache/${parser.workId}/${hash}.json`
        );
        if (cacheResponse.ok) {
          return await cacheResponse.json();
        } else if (cacheResponse.status === 404) {
          // キャッシュが存在しない
          return [];
        } else {
          throw new Error(`Failed to fetch: ${cacheResponse.statusText}`);
        }
      } catch (err) {
        // ローカルデバッグだと別ファイルをとってきて SyntaxError
        if (err instanceof SyntaxError) return [];
        throw err;
      }
    };

    // 最初にキャッシュチェック あれば終わり
    const cache = await getCache(hash);
    if (cache.length) return cache;

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
        const cache = await getCache(hash);
        if (cache.length) return cache;
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
          license_notice={config?.license_notice || ""}
        />
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
      <DialogRoot
        size="cover"
        placement="center"
        motionPreset="slide-in-bottom"
      >
        <DialogTrigger asChild>
          <Button
            ref={diagButtonRef}
            variant="outline"
            size="sm"
            visibility="hidden"
          >
            Open Dialog
          </Button>
        </DialogTrigger>
        {/* PortalでDialogContentをルートに移動 */}
        <Portal>
          <DialogContent
            width="80vw"
            height="90vh"
            position="fixed" // 画面全体に固定
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)" // 真ん中に表示
            backgroundColor="white"
            color="black"
            zIndex="overlay" // Chakra UI の z-index のプリセット
            boxShadow="lg"
            borderRadius="md"
            overflow={"auto"}
          >
            <DialogHeader>
              <DialogTitle>About</DialogTitle>
              <DialogCloseTrigger />
            </DialogHeader>
            <DialogBody>
              <Heading as="h1" size="2xl" mb={4}>
                本サイトについて
              </Heading>
              <Text>
                {config?.about?.split("\n").map((line, index) => (
                  <span key={index}>
                    {line}
                    <br />
                  </span>
                ))}
              </Text>
              <br />
              <Heading as="h1" size="2xl" mb={4}>
                用いられている技術について
              </Heading>
              <Text>
                {config?.technology_about?.split("\n").map((line, index) => (
                  <span key={index}>
                    {line}
                    <br />
                  </span>
                ))}
              </Text>
              <Heading as="h1" size="2xl" mb={4}>
                お問合せ
              </Heading>
              <Text>
                問題、要望、感想などありましたら、以下までご連絡ください。
              </Text>
              <br />
              <Text>Email: {config?.contact_email}</Text>
              <Text>
                X:{" "}
                <Link
                  href={`https://x.com/${config?.contact_x.slice(1)}`}
                  color={"black"}
                >
                  {config?.contact_x}
                </Link>
              </Text>
            </DialogBody>
          </DialogContent>
        </Portal>
      </DialogRoot>
    </Box>
  );
};

export default App;

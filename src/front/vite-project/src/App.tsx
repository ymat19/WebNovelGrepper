import {
  Box,
  Container,
  Flex,
  Spinner,
} from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import SearchForm from "./components/SearchForm";
import { SearchResults } from "./components/SearchResults";
import { AboutDialog } from "./components/AboutDialog";
import { WebSiteConfig, SearchResult } from "./types";
import { getRecords } from "./services/recordService";
import { getConfig } from "./services/configService";
import { query, createQueryString, search } from "./services/searchService";

const App: React.FC = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [config, setConfig] = useState<WebSiteConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const diagButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    getConfig().then((frontConfig) => {
      document.title = frontConfig.title;
      setConfig(frontConfig);
    }).catch((err) => {
      console.error(err);
    });
  }, []);


  const handleSearch = async (input: string) => {
    try {
      if (!config) {
        return;
      }
      setIsLoading(true);

      const queryString = createQueryString(input);
      setQuery(queryString);
      
      const results = await search(queryString, config, getRecords);
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
        contact_x={config?.contact_x || ""}
        endpoint={config?.api_endpoint_url || ""}>
      </AboutDialog>
    </Box>
  );
};

export default App;

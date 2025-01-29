import { Box, Input, Button, HStack } from "@chakra-ui/react";
import { useState } from "react";

interface SearchFormProps {
  onSearch: (query: string) => void;
}

const SearchForm: React.FC<SearchFormProps> = ({ onSearch }) => {
  const [query, setQuery] = useState<string>("");

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <Box mb={4}>
      <HStack>
        <Input
          placeholder="検索したい単語を入力してください"
          value={query}
          fontSize={16}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) =>
            !e.nativeEvent.isComposing && e.key === "Enter" && handleSearch()
          }
          color="#2C3E50"
          bg="#D4DDE4"
          borderColor="#98A5B3"
          _placeholder={{ color: "#2C3E50" }}
        />
        <Button
          colorScheme="blue"
          onClick={handleSearch}
          color="#2C3E50"
          bg="#D4DDE4"
          borderColor="#98A5B3"
        >
          検索
        </Button>
      </HStack>
    </Box>
  );
};

export default SearchForm;

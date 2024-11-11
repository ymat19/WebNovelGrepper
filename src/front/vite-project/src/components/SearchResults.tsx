import { Box, Text, Link, VStack, Button } from "@chakra-ui/react";
import { Checkbox } from "@/components/ui/checkbox";
import { FaArrowDown, FaArrowUp } from "react-icons/fa";
import { useState } from "react";

export interface SearchResult {
  body: string;
  line: number;
  number: string;
  subtitle: string;
  url: string;
  episodeId: bigint;
}

interface SearchResultsProps {
  results: SearchResult[];
  license_notice: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  license_notice,
}) => {
  const [isAscending, setIsAscending] = useState(true);
  const [isDialogueOnly, setIsDialogueOnly] = useState(false);
  if (results.length === 0) {
    return <Text color="gray.500">検索結果がありません。</Text>;
  }

  const sortFunc = (a: SearchResult, b: SearchResult) => {
    if (isAscending) {
      return Number(a.episodeId - b.episodeId);
    } else {
      return Number(b.episodeId - a.episodeId);
    }
  };

  return (
    <>
      <Box display="flex" alignItems="center" gap="2rem">
        <Button
          _hover={{ bg: "#98A5B3" }}
          color="#2C3E50"
          bg="#D4DDE4"
          borderColor="#98A5B3"
          onClick={() => setIsAscending(!isAscending)}
        >
          {isAscending ? "古い順　" : "新しい順"}
          {isAscending ? <FaArrowUp /> : <FaArrowDown />}
        </Button>
        <Checkbox
          size="lg"
          color="#2C3E50"
          borderColor="#98A5B3"
          checked={isDialogueOnly}
          onCheckedChange={(details) =>
            setIsDialogueOnly(Boolean(details.checked.valueOf()))
          }
        >
          セリフのみ
        </Checkbox>
      </Box>
      <Text color="#2C3E50" textStyle={"xs"}>{license_notice}</Text>
      <br />
      <Text color="#2C3E50">{results.length}件見つかりました</Text>
      <VStack align="stretch">
        {[...results]
          .filter((result) => !isDialogueOnly || result.body.startsWith("「"))
          .sort(sortFunc)
          .map((result, index) => (
            <Box
              key={index}
              borderWidth="1px"
              borderRadius="md"
              p={4}
              shadow="sm"
              borderColor="#C4A68A"
              bg="#F1E7DA"
              _hover={{ shadow: "md" }}
            >
              <Text fontWeight="bold" color="#6E4A34">
                {result.subtitle}
                <br />
                {result.number}: {result.line}行
              </Text>
              <Text mt={2} color="#4A4A4A">
                {result.body}
              </Text>
              <Link color="#8098FF" href={result.url} mt={2}>
                本編へ
              </Link>
            </Box>
          ))}
      </VStack>
    </>
  );
};

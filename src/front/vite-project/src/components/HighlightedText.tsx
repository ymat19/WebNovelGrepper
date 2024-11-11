import React from "react";
import { Text, Box, TextProps } from "@chakra-ui/react";

interface HighlightedTextProps extends TextProps {
  text: string;
  highlights: string[];
}

const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  highlights,
  ...textProps // TextPropsをスプレッドで受け取る
}) => {
  const regex = new RegExp(`(${highlights.join("|")})`, "gi");

  return (
    <Text {...textProps}>
      {text.split(regex).map((part, index) =>
        highlights.some(
          (highlight) => highlight.toLowerCase() === part.toLowerCase()
        ) ? (
          <Box as="span" bg="yellow.200" fontWeight="bold" key={index}>
            {part}
          </Box>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      )}
    </Text>
  );
};

export default HighlightedText;

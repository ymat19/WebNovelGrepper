import { Box, Text, HStack, Button } from "@chakra-ui/react";

interface HeaderProps {
  title: string;
  onClickAbout: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, onClickAbout }) => (
  <Box bg="#A3BCD8" color="white" p={4}>
    <HStack justifyContent="space-between" width="100%" paddingRight={8}>
      <Text fontSize="xl" fontWeight="bold" color="#2C3E50">
        {title}
      </Text>
      <Button
        bg="transparent"
        fontSize="xl"
        fontWeight="bold"
        color="#2C3E50"
        onClick={onClickAbout}
      >
        About
      </Button>
    </HStack>
  </Box>
);

export default Header;

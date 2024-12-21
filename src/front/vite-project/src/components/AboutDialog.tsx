import {
  Button,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  Heading,
  Link,
  Portal,
  Text,
} from "@chakra-ui/react";

interface AboutDialogProps {
  about: string;
  technology_about: string;
  contact_email: string;
  contact_x: string;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({
  about,
  technology_about,
  contact_email,
  contact_x,
  buttonRef,
}) => {
  return (
    <DialogRoot size="cover" placement="center" motionPreset="slide-in-bottom">
      <DialogTrigger asChild>
        <Button ref={buttonRef} variant="outline" size="sm" visibility="hidden">
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
              {about?.split("\n").map((line, index) => (
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
              {technology_about?.split("\n").map((line, index) => (
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
              問題、要望、ご意見などありましたら、以下までご連絡ください。
            </Text>
            <br />
            <Text>Email: {contact_email}</Text>
            <Text>
              X:{" "}
              <Link
                href={`https://x.com/${contact_x.slice(1)}`}
                color={"black"}
              >
                {contact_x}
              </Link>
            </Text>
          </DialogBody>
        </DialogContent>
      </Portal>
    </DialogRoot>
  );
};

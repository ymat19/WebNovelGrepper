import { useRef, useState } from "react";
import { HStack, Input, Text } from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToastContainer, toast } from "react-toastify";

interface RequestDialogProps {
  endpoint: string;
}

export const RequestDialog: React.FC<RequestDialogProps> = ({ endpoint }) => {
  const [requestBody, setRequestBody] = useState<string>("");
  const saveRef = useRef<HTMLButtonElement | null>(null);

  // https://zenn.dev/takky94/articles/f3096bb59761ee
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.key !== "Enter") return;
    saveRef.current?.click();
  };

  const sendRequest = async (body: string) => {
    if (body) await fetch(`${endpoint}?request=${body}`);
    toast("ありがとうございました！", {
      position: "bottom-center",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: false,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "colored",
    });
  };

  return (
    <HStack justifyContent={"flex-end"} margin={"16px"}>
      <ToastContainer />
      <DialogRoot placement="center" motionPreset="slide-in-bottom">
        <DialogTrigger asChild>
          <Text
            cursor="pointer"
            fontSize={"xs"}
            color="#8098FF"
            textDecoration="underline"
          >
            ３秒で遅れる匿名要望フォーム
          </Text>
        </DialogTrigger>
        <DialogContent
          backgroundColor="white"
          color="black"
          boxShadow="lg"
          borderRadius="md"
          overflow={"auto"}
        >
          <DialogHeader>
            <DialogTitle>要望フォーム</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text fontSize={"xs"} marginBottom={"16px"}>
              「こんな機能が欲しい！ここが使いにくい！」など教えていただきたいです！
              <br />
              メッセージは雑に、呟き感覚で大丈夫です。匿名で送信されます。
            </Text>
            <Input
              onChange={(event) => setRequestBody(event.target.value)}
              onKeyDown={handleKeyDown}
              color="#2C3E50"
              borderColor="#98A5B3"
              _placeholder={{ color: "#2C3E50" }}
              placeholder="要望、意見、感想など"
            />
          </DialogBody>
          <DialogFooter>
            <DialogActionTrigger asChild>
              <Button
                variant="outline"
                colorScheme="blue"
                color="#2C3E50"
                bg="#D4DDE4"
                borderColor="#98A5B3"
              >
                キャンセル
              </Button>
            </DialogActionTrigger>
            <DialogActionTrigger asChild>
              <Button
                ref={saveRef}
                colorScheme="blue"
                color="#2C3E50"
                bg="#D4DDE4"
                borderColor="#98A5B3"
                onClick={() => sendRequest(requestBody)}
              >
                送る
              </Button>
            </DialogActionTrigger>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>
    </HStack>
  );
};

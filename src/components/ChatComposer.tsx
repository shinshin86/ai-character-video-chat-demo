import { Send } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { shouldSubmitChatInput } from "../lib/chatInput";

interface ChatComposerProps {
  disabled: boolean;
  onSend: (message: string) => Promise<void>;
}

export function ChatComposer({ disabled, onSend }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const isComposingRef = useRef(false);

  const submit = async () => {
    const message = value.trim();
    if (!message || disabled) return;
    setValue("");
    await onSend(message);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const nativeEvent = event.nativeEvent;
    const shouldSubmit = shouldSubmitChatInput({
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: isComposingRef.current || nativeEvent.isComposing,
      keyCode: nativeEvent.keyCode,
    });

    if (shouldSubmit) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="composer">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
        }}
        onKeyDown={handleKeyDown}
        rows={1}
        maxLength={500}
        placeholder="メッセージを入力..."
        aria-label="チャットメッセージ"
        disabled={disabled}
      />
      <button
        type="button"
        className="send-button"
        onClick={() => void submit()}
        disabled={disabled || !value.trim()}
        aria-label="メッセージを送信"
      >
        <Send size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

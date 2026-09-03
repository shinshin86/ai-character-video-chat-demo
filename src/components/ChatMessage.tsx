import { Play, Sparkles } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "../types";

interface ChatMessageProps {
  message: ChatMessageType;
  avatarUrl: string;
  characterName: string;
  onPlayVideo: (videoUrl: string) => void;
}

export function ChatMessage({
  message,
  avatarUrl,
  characterName,
  onPlayVideo,
}: ChatMessageProps) {
  const isAssistant = message.role === "assistant";

  return (
    <article className={`message-row ${isAssistant ? "assistant" : "user"}`}>
      {isAssistant && (
        <div className="message-avatar" aria-hidden="true">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <Sparkles size={16} />
          )}
        </div>
      )}
      <div className="message-content">
        <span className="message-author">
          {isAssistant ? characterName : "You"}
        </span>
        <div className="message-bubble">
          <p>{message.text}</p>
          {message.videoUrl && (
            <button
              className="message-video-button"
              type="button"
              onClick={() => onPlayVideo(message.videoUrl!)}
            >
              <Play size={13} fill="currentColor" aria-hidden="true" />
              動画を再生
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

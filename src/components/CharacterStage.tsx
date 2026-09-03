import { useEffect, useRef, useState } from "react";
import { CircleUserRound, Volume2 } from "lucide-react";
import type { GenerationPhase } from "../types";

interface CharacterStageProps {
  characterName: string;
  imageUrl: string;
  videoUrl: string;
  playbackKey: number;
  phase: GenerationPhase;
  statusText: string;
  onOpenSettings: () => void;
}

export function CharacterStage({
  characterName,
  imageUrl,
  videoUrl,
  playbackKey,
  phase,
  statusText,
  onOpenSettings,
}: CharacterStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;
    setAutoplayBlocked(false);
    void videoRef.current.play().catch(() => setAutoplayBlocked(true));
  }, [videoUrl, playbackKey]);

  const isBusy = phase !== "idle";

  return (
    <section className="character-stage" aria-label="キャラクター動画">
      <div className="stage-ambient" aria-hidden="true" />

      {videoUrl ? (
        <video
          ref={videoRef}
          key={`${videoUrl}-${playbackKey}`}
          className="stage-media"
          src={videoUrl}
          controls
          playsInline
          autoPlay
          preload="metadata"
        />
      ) : imageUrl ? (
        <img
          className="stage-media"
          src={imageUrl}
          alt={`${characterName}のキャラクター画像`}
        />
      ) : (
        <div className="stage-empty">
          <div className="stage-empty-icon">
            <CircleUserRound size={56} strokeWidth={1.25} />
          </div>
          <p>キャラクター画像とfal API Keyを設定して始めましょう</p>
          <button className="secondary-button" type="button" onClick={onOpenSettings}>
            Settingsを開く
          </button>
        </div>
      )}

      <div className="stage-topline">
        <span className="live-dot" aria-hidden="true" />
        <span>{characterName}</span>
      </div>

      {isBusy && (
        <div className="generation-overlay" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <div>
            <strong>{statusText}</strong>
            <span>このまま画面を開いてお待ちください</span>
          </div>
        </div>
      )}

      {autoplayBlocked && videoUrl && !isBusy && (
        <div className="autoplay-hint">
          <Volume2 size={16} aria-hidden="true" />
          再生ボタンから音声付き動画を再生できます
        </div>
      )}
    </section>
  );
}

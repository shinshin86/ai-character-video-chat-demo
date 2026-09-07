import { useCallback, useEffect, useRef, useState } from "react";
import { CircleUserRound, Volume2 } from "lucide-react";

interface CharacterStageProps {
  characterName: string;
  imageUrl: string;
  idleVideoUrl: string;
  videoUrl: string;
  playbackKey: number;
  onOpenSettings: () => void;
}

interface ReplyClipProps {
  url: string;
  onReady: (start: () => void) => void;
  onStarted: () => void;
  onFinished: () => void;
}

function ReplyClip({ url, onReady, onStarted, onFinished }: ReplyClipProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const announced = useRef(false);
  const mounted = useRef(true);
  const [visible, setVisible] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const start = () => {
    const video = videoRef.current;
    if (!video || failed) return;
    setBlocked(false);
    void video.play().catch(() => {
      if (!mounted.current) return;
      setBlocked(true);
      onFinished();
    });
  };

  return (
    <>
      <video
        ref={videoRef}
        aria-label="返答動画"
        className={`stage-media stage-layer stage-reply${visible ? "" : " is-hidden"}`}
        src={url}
        controls={visible}
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        playsInline
        preload="auto"
        onCanPlay={() => {
          if (announced.current) return;
          announced.current = true;
          onReady(start);
        }}
        onPlaying={() => {
          setVisible(true);
          setBlocked(false);
          onStarted();
        }}
        onEnded={() => {
          setVisible(false);
          onFinished();
        }}
        onError={() => {
          setFailed(true);
          setVisible(false);
          onFinished();
        }}
      />
      {blocked && !failed && (
        <button className="autoplay-hint" type="button" onClick={start}>
          <Volume2 size={16} aria-hidden="true" />
          返答動画を音声付きで再生
        </button>
      )}
      {failed && (
        <div className="autoplay-hint" role="alert">返答動画を読み込めませんでした。チャットから再生をお試しください。</div>
      )}
    </>
  );
}

export function CharacterStage({
  characterName, imageUrl, idleVideoUrl, videoUrl, playbackKey, onOpenSettings,
}: CharacterStageProps) {
  const idleRef = useRef<HTMLVideoElement>(null);
  const queuedStart = useRef<(() => void) | null>(null);
  const [queued, setQueued] = useState(false);
  const [idleFailed, setIdleFailed] = useState(false);
  const [idleReady, setIdleReady] = useState(false);

  const resumeIdle = useCallback(() => {
    queuedStart.current = null;
    setQueued(false);
    const idle = idleRef.current;
    if (idle) {
      idle.loop = true;
      idle.currentTime = 0;
      void idle.play().catch(() => setIdleFailed(true));
    }
  }, []);

  useEffect(() => {
    setIdleFailed(false);
    setIdleReady(false);
  }, [idleVideoUrl]);

  useEffect(() => {
    queuedStart.current = null;
    setQueued(false);
    const idle = idleRef.current;
    if (idle) {
      idle.loop = true;
      if (idle.paused) void idle.play().catch(() => setIdleFailed(true));
    }
  }, [videoUrl, playbackKey]);

  const startQueued = () => {
    const start = queuedStart.current;
    queuedStart.current = null;
    setQueued(false);
    start?.();
  };

  return (
    <section className="character-stage" aria-label="キャラクター動画">
      <div className="stage-ambient" aria-hidden="true" />
      {imageUrl ? (
        <img className="stage-media" src={imageUrl} alt={`${characterName}のキャラクター画像`} />
      ) : (
        <div className="stage-empty">
          <div className="stage-empty-icon"><CircleUserRound size={56} strokeWidth={1.25} /></div>
          <p>キャラクター画像とfal API Keyを設定して始めましょう</p>
          <button className="secondary-button" type="button" onClick={onOpenSettings}>Settingsを開く</button>
        </div>
      )}
      {idleVideoUrl && !idleFailed && (
        <video
          key={idleVideoUrl}
          ref={idleRef}
          aria-label="アイドルモーション"
          className={`stage-media stage-layer${idleReady ? "" : " is-hidden"}`}
          src={idleVideoUrl}
          autoPlay
          muted
          playsInline
          loop={!queued}
          preload="auto"
          onLoadedData={() => setIdleReady(true)}
          onEnded={startQueued}
          onWaiting={startQueued}
          onError={() => { setIdleFailed(true); startQueued(); }}
        />
      )}
      {videoUrl && (
        <ReplyClip
          key={`${videoUrl}-${playbackKey}`}
          url={videoUrl}
          onReady={(start) => {
            const idle = idleRef.current;
            if (idle && !idle.paused && !idle.ended && idle.readyState >= 2) {
              queuedStart.current = start;
              setQueued(true);
            } else {
              start();
            }
          }}
          onStarted={() => idleRef.current?.pause()}
          onFinished={resumeIdle}
        />
      )}
      <div className="stage-topline">
        <span className="live-dot" aria-hidden="true" /><span>{characterName}</span>
      </div>
      {idleFailed && !videoUrl && (
        <div className="autoplay-hint" role="status">待ち受け動画を再生できないため、静止画を表示しています。</div>
      )}
    </section>
  );
}

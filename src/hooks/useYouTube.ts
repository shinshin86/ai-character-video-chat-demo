import { useCallback, useEffect, useRef, useState } from "react";
import { trimCommentQueue, YouTubeSession, youtubeVideoId, type ViewerComment, type YouTubeSettings } from "../lib/youtube";

export function useYouTube(settings: YouTubeSettings, busy: boolean, respond: (comment: ViewerComment) => Promise<boolean>) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("停止中");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  const [dropped, setDropped] = useState(0);
  const [lastComment, setLastComment] = useState<ViewerComment | null>(null);
  const queue = useRef<ViewerComment[]>([]);
  const controller = useRef<AbortController | null>(null);
  const active = useRef(false);
  const processing = useRef(false);
  const current = useRef({ busy, respond });
  current.current = { busy, respond };

  const stop = useCallback((message = "") => {
    active.current = false;
    controller.current?.abort();
    queue.current = [];
    setPending(0);
    setRunning(false);
    setStatus(message ? "接続停止" : "停止中");
    setError(message);
  }, []);
  const start = () => {
    if (!settings.apiKey || !youtubeVideoId(settings.liveUrl)) return;
    setError("");
    setDropped(0);
    setLastComment(null);
    setRunning(true);
  };

  useEffect(() => { stop(); }, [settings.apiKey, settings.liveUrl, settings.intervalSeconds, stop]);

  useEffect(() => {
    if (!running) return;
    const abort = new AbortController();
    controller.current = abort;
    active.current = true;
    const session = new YouTubeSession(settings);
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      setStatus((s) => s === "受信中" ? s : "接続中");
      try {
        const result = await session.poll(abort.signal);
        if (abort.signal.aborted) return;
        const combined = [...queue.current, ...result.comments];
        queue.current = trimCommentQueue(combined);
        setDropped((n) => n + combined.length - queue.current.length);
        setPending(queue.current.length);
        if (result.comments.length) setLastComment(result.comments.at(-1)!);
        setStatus("受信中");
        timer = setTimeout(() => void poll(), result.intervalMs);
      } catch (e) {
        if (!abort.signal.aborted) stop(e instanceof Error && !e.message.includes("fetch") ? e.message : "YouTubeに接続できません。ネットワークとAPIキーを確認してください。");
      }
    };
    void poll();
    return () => { abort.abort(); clearTimeout(timer); active.current = false; };
  }, [running, settings.apiKey, settings.liveUrl, settings.intervalSeconds, stop]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      if (!active.current || processing.current || current.current.busy) return;
      const filtered = trimCommentQueue(queue.current);
      setDropped((n) => n + queue.current.length - filtered.length);
      queue.current = filtered;
      const comment = queue.current.shift();
      setPending(queue.current.length);
      if (!comment) return;
      processing.current = true;
      const session = controller.current;
      try {
        const accepted = await current.current.respond(comment);
        if (!accepted && active.current && controller.current === session) {
          queue.current.unshift(comment);
          setPending(queue.current.length);
        }
      } catch {
        if (controller.current === session && active.current) stop("返答の生成に失敗したため、自動返答を停止しました。チャットのエラーを確認してください。");
      } finally { processing.current = false; }
    }, 500);
    return () => clearInterval(timer);
  }, [running, stop]);

  return { running, status, error, pending, dropped, lastComment, start, stop };
}
export type YouTubeControl = ReturnType<typeof useYouTube>;

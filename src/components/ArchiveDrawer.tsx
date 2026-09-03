import { Archive, Download, Play, X } from "lucide-react";
import type { ArchiveEntry } from "../types";

interface ArchiveDrawerProps {
  open: boolean;
  entries: ArchiveEntry[];
  loading: boolean;
  error: string;
  onClose: () => void;
  onPlay: (entry: ArchiveEntry) => void;
}

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function ArchiveDrawer({
  open,
  entries,
  loading,
  error,
  onClose,
  onPlay,
}: ArchiveDrawerProps) {
  if (!open) return null;

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside
        className="archive-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">LOCAL LIBRARY</span>
            <h2 id="archive-title">Video Archive</h2>
            <p>生成時の会話と動画を、このPCに保存しています。</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={20} aria-hidden="true" />
            <span className="sr-only">閉じる</span>
          </button>
        </header>

        <div className="archive-list">
          {loading ? (
            <div className="archive-empty">
              <span className="spinner" />
              読み込んでいます...
            </div>
          ) : error ? (
            <div className="inline-error" role="alert">
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="archive-empty">
              <Archive size={34} strokeWidth={1.4} aria-hidden="true" />
              <strong>保存された動画はまだありません</strong>
              <span>最初の会話動画を作ると、ここから見返せます。</span>
            </div>
          ) : (
            entries.map((entry) => (
              <article className="archive-card" key={entry.id}>
                <div className="archive-thumbnail">
                  <video
                    src={entry.localVideoUrl}
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <button
                    className="archive-thumbnail-play"
                    type="button"
                    onClick={() => onPlay(entry)}
                    aria-label="メイン画面で再生"
                  >
                    <Play size={18} fill="currentColor" aria-hidden="true" />
                  </button>
                  <a
                    className="archive-download-button"
                    href={entry.localVideoUrl}
                    download={`ai-character-video-${entry.id}.mp4`}
                    aria-label="MP4をダウンロード"
                    title="MP4をダウンロード"
                  >
                    <Download size={15} aria-hidden="true" />
                  </a>
                  <div className="archive-thumbnail-meta">
                    <span>{formatter.format(new Date(entry.createdAt))}</span>
                    <span>{entry.resolution}</span>
                  </div>
                </div>
                <div className="archive-card-body">
                  <div className="archive-line user-line">
                    <span>You</span>
                    <p>{entry.userMessage}</p>
                  </div>
                  <div className="archive-line character-line">
                    <span>{entry.characterName || "AI Character"}</span>
                    <p>{entry.assistantReply}</p>
                  </div>
                  <details>
                    <summary>生成情報</summary>
                    <dl>
                      <div>
                        <dt>LLM</dt>
                        <dd>{entry.llmModel}</dd>
                      </div>
                      <div>
                        <dt>fal request</dt>
                        <dd>{entry.falRequestId}</dd>
                      </div>
                      <div>
                        <dt>Video prompt</dt>
                        <dd>{entry.videoPrompt}</dd>
                      </div>
                    </dl>
                  </details>
                </div>
              </article>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

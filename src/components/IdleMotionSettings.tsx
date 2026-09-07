import { useState } from "react";
import type { ArchiveEntry } from "../types";
import { DEFAULT_IDLE_PROMPT, MAX_IDLE_PROMPT_LENGTH } from "../lib/idleMotion";

function IdlePreview({ url, label, onReady }: { url: string; label: string; onReady?: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="idle-preview">
      {failed ? (
        <p role="alert">動画を読み込めませんでした。再生成するか、アーカイブから別の動画を選んでください。</p>
      ) : (
        <video
          src={url}
          aria-label={label}
          autoPlay muted loop playsInline controls preload="auto"
          onLoadedData={onReady}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

interface IdleMotionSettingsProps {
  currentUrl: string;
  candidate?: ArchiveEntry;
  initialPrompt?: string;
  onPromptChange: (prompt: string) => void;
  blocked: boolean;
  hasUnsavedChanges: boolean;
  canGenerate: boolean;
  generating: boolean;
  status: string;
  error: string;
  onGenerate: (prompt: string) => Promise<void>;
  onApply: (entry: ArchiveEntry) => Promise<void>;
}

export function IdleMotionSettings({
  currentUrl, candidate, initialPrompt, onPromptChange, blocked, hasUnsavedChanges, canGenerate,
  generating, status, error, onGenerate, onApply,
}: IdleMotionSettingsProps) {
  const [prompt, setPrompt] = useState(initialPrompt ?? DEFAULT_IDLE_PROMPT);
  const updatePrompt = (value: string) => { setPrompt(value); onPromptChange(value); };
  const [candidateReadyUrl, setCandidateReadyUrl] = useState("");
  const candidateIsCurrent = Boolean(candidate && candidate.localVideoUrl === currentUrl);
  return (
    <section className="idle-settings" aria-labelledby="idle-motion-title">
      <strong id="idle-motion-title">アイドルモーション</strong>
      <p className="field-hint">生成した候補を確認し、気に入った動画を待ち受けに設定できます。プレビューは無音ループで再生します。</p>
      <div className="idle-preview-grid">
        <div className="idle-preview-card">
          <strong>現在の待ち受け</strong>
          {currentUrl ? <IdlePreview key={currentUrl} url={currentUrl} label="現在の待ち受けプレビュー" /> : (
            <div className="idle-preview"><p>動画は未設定です。静止画を表示しています。</p></div>
          )}
        </div>
        <div className="idle-preview-card">
          <strong>{candidateIsCurrent ? "設定した生成結果" : "生成候補（未適用）"}</strong>
          {candidate ? (
            <>
              <IdlePreview
                key={candidate.localVideoUrl}
                url={candidate.localVideoUrl}
                label="生成候補のプレビュー"
                onReady={() => setCandidateReadyUrl(candidate.localVideoUrl)}
              />
              <button
                type="button" className="secondary-button"
                disabled={blocked || hasUnsavedChanges || candidateIsCurrent || candidateReadyUrl !== candidate.localVideoUrl}
                onClick={() => void onApply(candidate)}
              >{candidateIsCurrent ? "設定中" : "この動画を設定"}</button>
            </>
          ) : <div className="idle-preview"><p>生成後にここで確認できます。過去の動画はArchiveから選べます。</p></div>}
        </div>
      </div>
      <div className="field-group">
        <label htmlFor="idle-motion-prompt">アイドルモーションのプロンプト</label>
        <textarea
          id="idle-motion-prompt" value={prompt} rows={7} maxLength={MAX_IDLE_PROMPT_LENGTH}
          onChange={(event) => updatePrompt(event.target.value)}
        />
        <button type="button" className="ghost-button" onClick={() => updatePrompt(DEFAULT_IDLE_PROMPT)}>
          デフォルトに戻す
        </button>
        <p className="field-hint">日本語でも編集できます。Save Changesまたは生成時に、内容を画像ごとに記憶します。開始・終了画像は登録画像に固定されます。大きな動きはつなぎ目が目立つ場合があります。</p>
      </div>
      <button
        className="secondary-button" type="button"
        disabled={blocked || hasUnsavedChanges || !canGenerate || !prompt.trim()}
        onClick={() => void onGenerate(prompt)}
      >{generating ? "作成しています..." : candidate || currentUrl ? "アイドルモーションを再生成" : "アイドルモーションを作成"}</button>
      <p className="field-hint">作成・再生成ごとに動画生成料金が発生します。プレビュー・設定・ループ再生は追加料金なしです。採用しなかった動画もArchiveに保存されます。</p>
      <p className="field-hint" role="status">
        {status || (hasUnsavedChanges ? "先にSave Changesで画像と設定を保存してください。"
          : !canGenerate ? "生成には保存済み画像とfal API Keyが必要です。"
            : "「この動画を設定」を押すまで、現在の待ち受けを維持します。")}
      </p>
      {error && <p className="inline-error" role="alert">{error}</p>}
    </section>
  );
}

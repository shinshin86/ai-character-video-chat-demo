import { useEffect, useState } from "react";
import type { ArchiveEntry } from "../types";
import { canApplyIdle, DEFAULT_IDLE_PROMPT, MAX_IDLE_PROMPT_LENGTH } from "../lib/idleMotion";

function IdlePreview({ url, label, onReady, onError }: { url: string; label: string; onReady?: () => void; onError?: () => void }) {
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
          onError={() => { setFailed(true); onError?.(); }}
        />
      )}
    </div>
  );
}

interface IdleMotionSettingsProps {
  imageUrl: string;
  archives: ArchiveEntry[];
  archivesLoading: boolean;
  archivesError: string;
  onRefreshArchives: () => Promise<void>;
  onApplyArchived: (entry: ArchiveEntry) => Promise<void>;
  hasApiKey: boolean;
  onOpenApiSettings: () => void;
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
  imageUrl, archives, archivesLoading, archivesError, onRefreshArchives, onApplyArchived, hasApiKey, onOpenApiSettings,
  currentUrl, candidate, initialPrompt, onPromptChange, blocked, hasUnsavedChanges, canGenerate,
  generating, status, error, onGenerate, onApply,
}: IdleMotionSettingsProps) {
  const [validationError, setValidationError] = useState("");
  useEffect(() => { setValidationError(""); }, [hasApiKey, imageUrl]);
  const [selectedArchiveId, setSelectedArchiveId] = useState("");
  const [archiveReadyUrl, setArchiveReadyUrl] = useState("");
  const availableArchives = archives.filter((entry) => canApplyIdle(entry, imageUrl));
  const selectedArchive = availableArchives.find((entry) => entry.id === selectedArchiveId);
  const generate = () => {
    setValidationError("");
    if (!hasApiKey) { setValidationError("APIキーが未設定です。「AI・動画」タブでfal API Keyを入力し、Save Changesで保存してください。"); return; }
    if (hasUnsavedChanges) { setValidationError("先にSave Changesで画像と設定を保存してください。"); return; }
    if (!canGenerate) { setValidationError("生成するキャラクター画像を登録・保存してください。"); return; }
    if (!prompt.trim()) { setValidationError("アイドルモーションのプロンプトを入力してください。"); return; }
    void onGenerate(prompt);
  };
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
                onError={() => setCandidateReadyUrl("")}
              />
              <button
                type="button" className="secondary-button"
                disabled={blocked || hasUnsavedChanges || candidateIsCurrent || candidateReadyUrl !== candidate.localVideoUrl}
                onClick={() => void onApply(candidate)}
              >{candidateIsCurrent ? "設定中" : "この動画を設定"}</button>
            </>
          ) : <div className="idle-preview"><p>生成後にここで確認できます。過去の動画は下の一覧から選べます。</p></div>}
        </div>
      </div>
      <section className="idle-archive-picker field-group" aria-label="過去のアイドル動画">
        <div className="model-field-heading">
          <label htmlFor="idle-archive-select">過去のアイドル動画</label>
          <button type="button" className="ghost-button" disabled={blocked || archivesLoading} onClick={() => void onRefreshArchives()}>一覧を更新</button>
        </div>
        <p className="field-hint">現在の登録画像から生成した動画を選び、プレビューして設定できます。</p>
        {archivesLoading ? <p className="field-hint" role="status">アーカイブを読み込んでいます...</p>
          : archivesError ? <p className="inline-error" role="alert">{archivesError}</p>
          : availableArchives.length === 0 ? <p className="field-hint">この画像のアイドル動画はまだありません。</p>
          : <>
            <select id="idle-archive-select" value={selectedArchive?.id ?? ""} disabled={blocked || hasUnsavedChanges}
              onChange={(event) => { setArchiveReadyUrl(""); setSelectedArchiveId(event.target.value); }}>
              <option value="">動画を選択（{availableArchives.length}件）</option>
              {availableArchives.map((entry) => <option key={entry.id} value={entry.id}>
                {new Date(entry.createdAt).toLocaleString("ja-JP")} · {entry.resolution}{entry.localVideoUrl === currentUrl ? " · 設定中" : ""}
              </option>)}
            </select>
            {selectedArchive && <>
              <IdlePreview key={selectedArchive.localVideoUrl} url={selectedArchive.localVideoUrl} label="過去のアイドル動画のプレビュー"
                onReady={() => setArchiveReadyUrl(selectedArchive.localVideoUrl)} onError={() => setArchiveReadyUrl("")} />
              <button type="button" className="secondary-button"
                disabled={blocked || hasUnsavedChanges || archivesLoading || Boolean(archivesError) || archiveReadyUrl !== selectedArchive.localVideoUrl || selectedArchive.localVideoUrl === currentUrl}
                onClick={() => void onApplyArchived(selectedArchive)}>
                {selectedArchive.localVideoUrl === currentUrl ? "設定中" : "選んだ動画を待ち受けに設定"}
              </button>
            </>}
          </>}
      </section>
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
        disabled={blocked}
        onClick={generate}
      >{generating ? "作成しています..." : candidate || currentUrl ? "アイドルモーションを再生成" : "アイドルモーションを作成"}</button>
      <p className="field-hint">作成・再生成ごとに動画生成料金が発生します。プレビュー・設定・ループ再生は追加料金なしです。採用しなかった動画もArchiveに保存されます。</p>
      <p className="field-hint" role="status">
        {status || (hasUnsavedChanges ? "先にSave Changesで画像と設定を保存してください。"
          : !canGenerate ? "生成には保存済み画像とfal API Keyが必要です。"
            : "「この動画を設定」を押すまで、現在の待ち受けを維持します。")}
      </p>
      {validationError && <div className="inline-error" role="alert">
        <p>{validationError}</p>
        {!hasApiKey && <button type="button" className="secondary-button" onClick={onOpenApiSettings}>AI・動画の設定を開く</button>}
      </div>}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </section>
  );
}

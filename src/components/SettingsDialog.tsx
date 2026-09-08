import type { YouTubeControl } from "../hooks/useYouTube";
import { YouTubeFields, YouTubeMonitor } from "./YouTubeSettings";
import { youtubeVideoId } from "../lib/youtube";
import { normalizeVideoModel, VIDEO_MODELS } from "../lib/videoModels";
import {
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AppSettings, ArchiveEntry, LlmModelOption, ReferenceImage } from "../types";
import { IdleMotionSettings } from "./IdleMotionSettings";
import { validateCharacterImage } from "../lib/fal";
import { formatPerMillionPrice } from "../lib/models";

interface SettingsDialogProps {
  archives: ArchiveEntry[];
  archivesLoading: boolean;
  archivesError: string;
  onRefreshArchives: () => Promise<void>;
  youtube: YouTubeControl;
  open: boolean;
  settings: AppSettings;
  saving: boolean;
  busy: boolean;
  idleGenerating: boolean;
  idleStatus: string;
  idleError: string;
  idleCandidate?: ArchiveEntry;
  onApplyIdle: (entry: ArchiveEntry, prompt?: string) => Promise<void>;
  onGenerateIdle: (prompt: string) => Promise<void>;
  error: string;
  llmModels: LlmModelOption[];
  llmModelsLoading: boolean;
  llmModelsError: string;
  referenceImages: ReferenceImage[];
  referenceImagesLoading: boolean;
  referenceImagesError: string;
  onRefreshModels: () => Promise<void>;
  onRefreshReferenceImages: () => Promise<void>;
  onClose: () => void;
  onSave: (settings: AppSettings, image: File | null) => Promise<void>;
  onReset: () => void;
}

export function SettingsDialog({
  archives, archivesLoading, archivesError, onRefreshArchives,
  youtube,
  open,
  settings,
  saving,
  busy,
  idleGenerating,
  idleStatus,
  idleError,
  onGenerateIdle,
  idleCandidate,
  onApplyIdle,
  error,
  llmModels,
  llmModelsLoading,
  llmModelsError,
  referenceImages,
  referenceImagesLoading,
  referenceImagesError,
  onRefreshModels,
  onRefreshReferenceImages,
  onClose,
  onSave,
  onReset,
}: SettingsDialogProps) {
  const [tab, setTab] = useState<"avatar" | "models" | "stream">("avatar");
  const [draft, setDraft] = useState(settings);
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(settings.characterImageUrl);
  const [showKey, setShowKey] = useState(false);
  const [localError, setLocalError] = useState("");
  const modelGroups = useMemo(() => {
    const groups = new Map<string, LlmModelOption[]>();
    for (const model of llmModels) {
      const group = groups.get(model.provider) ?? [];
      group.push(model);
      groups.set(model.provider, group);
    }
    return [...groups.entries()];
  }, [llmModels]);
  const selectedModel = llmModels.find((model) => model.id === draft.llmModel);
  const currentModelIsListed = Boolean(selectedModel);

  useEffect(() => {
    if (!open) return;
    setDraft(settings);
    setImage(null);
    setPreviewUrl(settings.characterImageUrl);
    setLocalError("");
  }, [open, settings]);

  useEffect(() => {
    if (!image) return;
    const objectUrl = URL.createObjectURL(image);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  useEffect(() => {
    if (!open || image || !draft.characterReferenceId) return;
    const selected = referenceImages.find(
      (entry) => entry.id === draft.characterReferenceId,
    );
    if (selected) setPreviewUrl(selected.localImageUrl);
  }, [draft.characterReferenceId, image, open, referenceImages]);

  const hasUnsavedChanges = Boolean(image) || JSON.stringify({ ...draft, idlePrompts: settings.idlePrompts }) !== JSON.stringify(settings);
  const idleVideoUrl = settings.idleVideoUrls[settings.characterImageUrl];

  if (!open) return null;

  const chooseImage = (file: File | undefined) => {
    if (!file) return;
    try {
      validateCharacterImage(file);
      setImage(file);
      setDraft((current) => ({ ...current, characterReferenceId: "" }));
      setLocalError("");
    } catch (uploadError) {
      setLocalError(
        uploadError instanceof Error
          ? uploadError.message
          : "画像を読み込めませんでした。",
      );
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setLocalError("");
    void onSave(
      {
        ...draft,
        characterName: draft.characterName.trim(),
        characterPersona: draft.characterPersona.trim(),
        llmModel: draft.llmModel.trim(),
      },
      image,
    );
  };

  return (
    <div className="dialog-backdrop">
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">PREFERENCES</span>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={20} aria-hidden="true" />
            <span className="sr-only">閉じる</span>
          </button>
        </header>

        <div className="settings-tabs" role="tablist" aria-label="設定カテゴリ">
          {([{ id: "avatar", label: "アバター" }, { id: "models", label: "AI・動画" }, { id: "stream", label: "YouTube配信" }] as const).map((item, index) => (
            <button key={item.id} id={`settings-tab-${item.id}`} type="button" role="tab"
              aria-selected={tab === item.id} aria-controls={`settings-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)}
              onKeyDown={(event) => {
                const ids = ["avatar", "models", "stream"] as const;
                const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
                if (next < 0) return;
                event.preventDefault();
                setTab(ids[next]);
                document.getElementById(`settings-tab-${ids[next]}`)?.focus();
              }}>{item.label}</button>
          ))}
        </div>

        <form onSubmit={submit} className="settings-form">
          <div className="settings-panels">
            <section role="tabpanel" id="settings-panel-avatar" aria-labelledby="settings-tab-avatar" hidden={tab !== "avatar"} tabIndex={0}>
              <fieldset className="settings-tab-fields" disabled={busy || saving}>
          <div className="field-group">
            <label>Character Image</label>
            <label className="image-picker">
              {previewUrl ? (
                <img src={previewUrl} alt="選択中のキャラクター" />
              ) : (
                <span className="image-picker-empty">
                  <ImagePlus size={24} aria-hidden="true" />
                  <span>PNG / JPG / WebP</span>
                </span>
              )}
              <span className="image-picker-action">
                {previewUrl ? "画像を変更" : "画像を選択"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,.jpg,.jpeg,.png,.webp"
                disabled={saving || busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  chooseImage(file);
                }}
              />
            </label>
            <p className="field-hint">
              新しい画像はローカルにも保存し、falへは一度だけアップロードします。
            </p>
            <section
              className="reference-library"
              aria-labelledby="reference-library-title"
            >
              <div className="reference-library-heading">
                <div>
                  <strong id="reference-library-title">Saved Images</strong>
                  {!referenceImagesLoading && (
                    <span>{referenceImages.length}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="model-refresh-button"
                  onClick={() => void onRefreshReferenceImages()}
                  disabled={referenceImagesLoading || saving || busy}
                >
                  <RefreshCw
                    size={13}
                    aria-hidden="true"
                    className={
                      referenceImagesLoading ? "is-spinning" : undefined
                    }
                  />
                  再取得
                </button>
              </div>

              {referenceImagesLoading ? (
                <p className="reference-library-message">
                  保存済み画像を読み込んでいます...
                </p>
              ) : referenceImagesError ? (
                <p className="reference-library-message is-error" role="alert">
                  {referenceImagesError}
                </p>
              ) : referenceImages.length === 0 ? (
                <p className="reference-library-message">
                  画像を保存すると、次回からここで選択できます。
                </p>
              ) : (
                <div className="reference-grid" role="list">
                  {referenceImages.map((entry) => {
                    const selected =
                      draft.characterReferenceId === entry.id ||
                      (!draft.characterReferenceId &&
                        !image &&
                        draft.characterImageUrl === entry.remoteImageUrl);
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={`reference-card${
                          selected ? " is-selected" : ""
                        }`}
                        aria-pressed={selected}
                        aria-label={`${entry.originalName}を選択`}
                        disabled={saving || busy}
                        onClick={() => {
                          setImage(null);
                          setPreviewUrl(entry.localImageUrl);
                          setDraft((current) => ({
                            ...current,
                            characterImageUrl: entry.remoteImageUrl,
                            characterReferenceId: entry.id,
                          }));
                          setLocalError("");
                        }}
                      >
                        <span className="reference-thumbnail">
                          <img src={entry.localImageUrl} alt="" />
                          {selected && (
                            <span className="reference-check" aria-hidden="true">
                              <Check size={13} />
                            </span>
                          )}
                        </span>
                        <span title={entry.originalName}>
                          {entry.originalName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

            <div className="field-group">
              <label htmlFor="character-name">Character Name</label>
              <input
                id="character-name"
                value={draft.characterName}
                maxLength={60}
                placeholder="任意のキャラクター名"
                onChange={(event) =>
                  setDraft({ ...draft, characterName: event.target.value })
                }
              />
            </div>
          <div className="field-group">
            <label htmlFor="character-persona">Character Persona</label>
            <textarea
              id="character-persona"
              rows={4}
              maxLength={2_000}
              value={draft.characterPersona}
              placeholder="話し方や性格を自由に設定（任意）"
              onChange={(event) =>
                setDraft({ ...draft, characterPersona: event.target.value })
              }
            />
          </div>

          <IdleMotionSettings
            imageUrl={settings.characterImageUrl}
            archives={archives}
            archivesLoading={archivesLoading}
            archivesError={archivesError}
            onRefreshArchives={onRefreshArchives}
            onApplyArchived={(entry) => onApplyIdle(entry)}
            hasApiKey={Boolean(settings.falApiKey.trim())}
            onOpenApiSettings={() => { setTab("models"); document.getElementById("settings-tab-models")?.focus(); }}
            key={settings.characterImageUrl}
            currentUrl={idleVideoUrl ?? ""}
            candidate={idleCandidate}
            initialPrompt={settings.idlePrompts[settings.characterImageUrl]}
            onPromptChange={(prompt) => setDraft((current) => ({
              ...current,
              idlePrompts: { ...current.idlePrompts, [settings.characterImageUrl]: prompt },
            }))}
            blocked={busy || saving}
            hasUnsavedChanges={hasUnsavedChanges}
            canGenerate={Boolean(settings.characterImageUrl && settings.falApiKey)}
            generating={idleGenerating}
            status={idleStatus}
            error={idleError}
            onGenerate={onGenerateIdle}
            onApply={(entry) => onApplyIdle(entry, draft.idlePrompts[settings.characterImageUrl])}
          />

              </fieldset>
            </section>
            <section role="tabpanel" id="settings-panel-models" aria-labelledby="settings-tab-models" hidden={tab !== "models"} tabIndex={0}>
              <fieldset className="settings-tab-fields" disabled={busy || saving}>
          <div className="field-group">
            <label htmlFor="fal-api-key">fal API Key</label>
            <div className="password-field">
              <input
                id="fal-api-key"
                type={showKey ? "text" : "password"}
                value={draft.falApiKey}
                onChange={(event) =>
                  setDraft({ ...draft, falApiKey: event.target.value })
                }
                placeholder="XXXXXXXXXXXXXXXX"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey((current) => !current)}
                aria-label={showKey ? "APIキーを隠す" : "APIキーを表示"}
              >
                {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <p className="field-hint">
              LLM・画像アップロード・動画生成で同じキーを使います。この端末のlocalStorageに保存されるローカルデモ専用の設定です。
            </p>
          </div>

          <div className="field-group">
            <label htmlFor="video-model">Video Model</label>
            <select
              id="video-model"
              value={draft.videoModel}
              onChange={(event) => setDraft({ ...draft, videoModel: normalizeVideoModel(event.target.value) })}
            >
              {Object.entries(VIDEO_MODELS).map(([id, model]) => (
                <option key={id} value={id}>{model.label}</option>
              ))}
            </select>
            <p className="field-hint">保存後、会話動画とアイドル動画の両方に適用されます。生成済みの動画は変更されません。</p>
          </div>

            <div className="field-group">
              <label htmlFor="video-resolution">Video Resolution</label>
              <select
                id="video-resolution"
                value={draft.resolution}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    resolution: event.target.value === "768P" ? "768P" : "480P",
                  })
                }
              >
                <option value="480P">480P — faster</option>
                <option value="768P">768P — higher quality</option>
              </select>
            </div>
          <div className="field-group">
            <div className="model-field-heading">
              <label htmlFor="llm-model">fal LLM Model</label>
              <button
                type="button"
                className="model-refresh-button"
                onClick={() => void onRefreshModels()}
                disabled={llmModelsLoading}
              >
                <RefreshCw
                  size={13}
                  aria-hidden="true"
                  className={llmModelsLoading ? "is-spinning" : undefined}
                />
                再取得
              </button>
            </div>
            <select
              id="llm-model"
              value={draft.llmModel}
              onChange={(event) =>
                setDraft({ ...draft, llmModel: event.target.value })
              }
            >
              {!currentModelIsListed && draft.llmModel && (
                <option value={draft.llmModel}>
                  {draft.llmModel} — 現在の設定
                </option>
              )}
              {modelGroups.map(([provider, models]) => (
                <optgroup
                  key={provider}
                  label={`${provider} (${models.length})`}
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="field-hint">
              {llmModelsLoading
                ? "OpenRouterのモデル一覧を読み込んでいます..."
                : llmModelsError
                  ? `${llmModelsError} 現在のモデル設定はそのまま利用できます。`
                  : `${llmModels.length}モデルから選択できます。会話生成はfalのOpenAI互換APIを使用します。`}
            </p>
            {selectedModel && (
              <p className="model-price-hint">
                参考単価 / 100万token：入力 {formatPerMillionPrice(selectedModel.promptPerMillion)}・出力 {formatPerMillionPrice(selectedModel.completionPerMillion)}
                {selectedModel.contextLength
                  ? ` · Context ${selectedModel.contextLength.toLocaleString()}`
                  : ""}
              </p>
            )}
          </div>

              </fieldset>
            </section>
            <section role="tabpanel" id="settings-panel-stream" aria-labelledby="settings-tab-stream" hidden={tab !== "stream"} tabIndex={0}>
          <YouTubeMonitor control={youtube} canStart={!hasUnsavedChanges && !busy && !saving && Boolean(settings.falApiKey && settings.characterImageUrl && settings.youtube.apiKey && youtubeVideoId(settings.youtube.liveUrl))} />
              <fieldset className="settings-tab-fields" disabled={busy || saving}>
          <YouTubeFields value={draft.youtube} onChange={(value) => setDraft({ ...draft, youtube: value })} />
              </fieldset>
            </section>
          </div>
          {(localError || error) && (
            <div className="inline-error" role="alert">
              {localError || error}
            </div>
          )}

          <footer className="dialog-actions">
            <button
              type="button"
              className="reset-button"
              onClick={onReset}
              disabled={saving || busy}
            >
              <RotateCcw size={15} aria-hidden="true" />
              Reset Settings
            </button>
            <div>
              <button
                type="button"
                className="ghost-button"
                onClick={onClose}
                disabled={saving || busy}
              >
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={saving || busy}>
                {saving ? "保存しています..." : "Save Changes"}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

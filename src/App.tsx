import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive as ArchiveIcon,
  MessageCircleMore,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from "lucide-react";
import { ArchiveDrawer } from "./components/ArchiveDrawer";
import { CharacterStage } from "./components/CharacterStage";
import { ChatComposer } from "./components/ChatComposer";
import { ChatMessage } from "./components/ChatMessage";
import { SettingsDialog } from "./components/SettingsDialog";
import { fetchArchive } from "./lib/archive";
import { generateCharacterReply } from "./lib/chat";
import { getErrorMessage } from "./lib/errors";
import { uploadCharacterImage } from "./lib/fal";
import { canApplyIdle } from "./lib/idleMotion";
import { fetchLlmModels } from "./lib/models";
import { fetchReferenceImages } from "./lib/references";
import {
  loadSettings,
  resetSettings,
  saveSettings,
} from "./lib/storage";
import { generateAndArchiveVideo, preloadVideo } from "./lib/video";
import type {
  AppSettings,
  ArchiveEntry,
  ChatMessage as ChatMessageType,
  GenerationPhase,
  LlmModelOption,
  ReferenceImage,
} from "./types";

function createMessage(
  role: ChatMessageType["role"],
  text: string,
): ChatMessageType {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    createdAt: new Date().toISOString(),
  };
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [videoPlaybackKey, setVideoPlaybackKey] = useState(0);
  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [llmModels, setLlmModels] = useState<LlmModelOption[]>([]);
  const [llmModelsLoading, setLlmModelsLoading] = useState(false);
  const [llmModelsError, setLlmModelsError] = useState("");
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [referenceImagesLoading, setReferenceImagesLoading] = useState(true);
  const [referenceImagesError, setReferenceImagesError] = useState("");
  const [idleCandidates, setIdleCandidates] = useState<Record<string, ArchiveEntry>>({});
  const [idleApplying, setIdleApplying] = useState(false);
  const [idleGenerating, setIdleGenerating] = useState(false);
  const [idleError, setIdleError] = useState("");
  const generationLock = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const ready = Boolean(settings.falApiKey && settings.characterImageUrl);
  const isBusy = phase !== "idle";
  const idleVideoUrl = settings.idleVideoUrls[settings.characterImageUrl] ?? "";
  const characterDisplayName = settings.characterName.trim() || "AI Character";
  const selectedReferenceImage = referenceImages.find(
    (image) => image.id === settings.characterReferenceId,
  );
  const characterDisplayImageUrl =
    selectedReferenceImage?.localImageUrl || settings.characterImageUrl;

  const loadArchives = useCallback(async () => {
    setArchiveLoading(true);
    setArchiveError("");
    try {
      setArchives(await fetchArchive());
    } catch (archiveLoadError) {
      setArchiveError(
        getErrorMessage(
          archiveLoadError,
          "ローカルアーカイブを読み込めませんでした。",
        ),
      );
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  const loadLlmModelCatalog = useCallback(async () => {
    setLlmModelsLoading(true);
    setLlmModelsError("");
    try {
      setLlmModels(await fetchLlmModels());
    } catch (modelLoadError) {
      setLlmModelsError(
        getErrorMessage(modelLoadError, "LLMモデル一覧を取得できませんでした。"),
      );
    } finally {
      setLlmModelsLoading(false);
    }
  }, []);

  const loadReferenceImages = useCallback(async () => {
    setReferenceImagesLoading(true);
    setReferenceImagesError("");
    try {
      setReferenceImages(await fetchReferenceImages());
    } catch (referenceLoadError) {
      setReferenceImagesError(
        getErrorMessage(
          referenceLoadError,
          "保存済み画像を読み込めませんでした。",
        ),
      );
    } finally {
      setReferenceImagesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchives();
  }, [loadArchives]);

  useEffect(() => {
    void loadLlmModelCatalog();
  }, [loadLlmModelCatalog]);

  useEffect(() => {
    void loadReferenceImages();
  }, [loadReferenceImages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, phase]);

  const playVideo = useCallback((videoUrl: string) => {
    setCurrentVideoUrl(videoUrl);
    setVideoPlaybackKey((current) => current + 1);
  }, []);

  const statusLabel = useMemo(() => {
    if (statusText) return statusText;
    if (phase === "thinking") return "返答を考えています...";
    if (phase === "archiving") return "動画をローカルに保存しています...";
    if (phase === "generating") return "動画を生成しています...";
    return "";
  }, [phase, statusText]);

  const handleSaveSettings = async (
    nextSettings: AppSettings,
    image: File | null,
  ) => {
    if (generationLock.current) return;
    setSettingsError("");
    setSavingSettings(true);

    try {
      let characterImageUrl = nextSettings.characterImageUrl;
      let characterReferenceId = nextSettings.characterReferenceId;
      if (image) {
        if (!nextSettings.falApiKey.trim()) {
          throw new Error("画像をアップロードするにはfal API Keyが必要です。");
        }
        const referenceImage = await uploadCharacterImage(
          image,
          nextSettings.falApiKey.trim(),
        );
        characterImageUrl = referenceImage.remoteImageUrl;
        characterReferenceId = referenceImage.id;
        setReferenceImages((current) => [
          referenceImage,
          ...current.filter((entry) => entry.id !== referenceImage.id),
        ]);
      }

      const saved = {
        ...nextSettings,
        falApiKey: nextSettings.falApiKey.trim(),
        characterImageUrl,
        characterReferenceId,
      };
      saveSettings(saved);
      setSettings(saved);
      if (saved.characterImageUrl !== settings.characterImageUrl) {
        setCurrentVideoUrl("");
        setMessages([]);
        setIdleError("");
      }
      setSettingsOpen(false);
      setError("");
    } catch (settingsSaveError) {
      setSettingsError(
        getErrorMessage(settingsSaveError, "設定を保存できませんでした。"),
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSettings = () => {
    if (generationLock.current) return;
    const defaults = resetSettings();
    setSettings(defaults);
    setIdleCandidates({});
    setIdleError("");
    setCurrentVideoUrl("");
    setSettingsError("");
  };

  const handleSend = async (text: string) => {
    if (generationLock.current || savingSettings) return;
    if (!ready) {
      setSettingsError(
        !settings.falApiKey
          ? "fal API Keyを設定してください。"
          : "Character Imageを設定してください。",
      );
      setSettingsOpen(true);
      return;
    }

    generationLock.current = true;
    setError("");
    const userMessage = createMessage("user", text);
    const conversation = [...messages, userMessage];
    setMessages(conversation);
    setPhase("thinking");
    setStatusText("返答を考えています...");

    let assistantMessage: ChatMessageType | undefined;
    try {
      const reply = await generateCharacterReply(settings, conversation);
      assistantMessage = createMessage("assistant", reply.dialogue);
      setMessages((current) => [...current, assistantMessage!]);
      setPhase("generating");
      setStatusText("動画を生成しています...");

      const archive = await generateAndArchiveVideo({
        settings,
        userMessage: text,
        assistantReply: reply.dialogue,
        performance: reply,
        onStatus: (status) => {
          if (status === "ARCHIVING") {
            setPhase("archiving");
            setStatusText("動画をローカルに保存しています...");
          } else if (status === "IN_QUEUE") {
            setStatusText("動画生成の順番を待っています...");
          } else {
            setStatusText("動画を生成しています...");
          }
        },
      });

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage!.id
            ? {
                ...message,
                videoUrl: archive.localVideoUrl,
                archiveId: archive.id,
              }
            : message,
        ),
      );
      playVideo(archive.localVideoUrl);
      setArchives((current) => [
        archive,
        ...current.filter((entry) => entry.id !== archive.id),
      ]);
    } catch (sendError) {
      setError(getErrorMessage(sendError));
    } finally {
      generationLock.current = false;
      setPhase("idle");
      setStatusText("");
    }
  };

  const handleGenerateIdle = async (prompt: string) => {
    if (generationLock.current || savingSettings || !ready) return;
    generationLock.current = true;
    setIdleGenerating(true);
    setIdleError("");
    setPhase("generating");
    setStatusText("アイドルモーションを生成しています...");
    try {
      const saved = { ...settings, idlePrompts: { ...settings.idlePrompts, [settings.characterImageUrl]: prompt.trim() } };
      saveSettings(saved);
      setSettings(saved);
      const archive = await generateAndArchiveVideo({
        settings,
        kind: "idle",
        idlePrompt: prompt,
        onStatus: (status) => {
          setStatusText(status === "IN_QUEUE"
            ? "アイドルモーションの生成順を待っています..."
            : status === "ARCHIVING"
              ? "アイドルモーションを保存しています..."
              : "アイドルモーションを生成しています...");
        },
      });
      setArchives((current) => [archive, ...current.filter((entry) => entry.id !== archive.id)]);
      setStatusText("アイドルモーションの再生準備をしています...");
      await preloadVideo(archive.localVideoUrl);
      setIdleCandidates((current) => ({ ...current, [settings.characterImageUrl]: archive }));
    } catch (generationError) {
      setIdleError(getErrorMessage(generationError, "アイドルモーションを作成できませんでした。"));
    } finally {
      generationLock.current = false;
      setIdleGenerating(false);
      setPhase("idle");
      setStatusText("");
    }
  };

  const handleApplyIdle = async (entry: ArchiveEntry, prompt?: string) => {
    if (generationLock.current || savingSettings) return;
    if (!canApplyIdle(entry, settings.characterImageUrl)) {
      setIdleError("現在の登録画像から生成したアイドル動画を選んでください。");
      return;
    }
    generationLock.current = true;
    setIdleApplying(true);
    setIdleError("");
    setPhase("archiving");
    setStatusText("待ち受け動画を設定しています...");
    try {
      await preloadVideo(entry.localVideoUrl);
      const saved = {
        ...settings,
        idleVideoUrls: { ...settings.idleVideoUrls, [settings.characterImageUrl]: entry.localVideoUrl },
        idlePrompts: prompt === undefined ? settings.idlePrompts : { ...settings.idlePrompts, [settings.characterImageUrl]: prompt },
      };
      saveSettings(saved);
      setCurrentVideoUrl("");
      setSettings(saved);
    } catch (applyError) {
      setIdleError(getErrorMessage(applyError, "待ち受け動画を設定できませんでした。"));
    } finally {
      generationLock.current = false;
      setIdleApplying(false);
      setPhase("idle");
      setStatusText("");
    }
  };

  const playArchive = (entry: ArchiveEntry) => {
    playVideo(entry.localVideoUrl);
    setArchiveOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Sparkles size={19} />
          </span>
          <div>
            <strong>AI Character Chat</strong>
            <span>{characterDisplayName}</span>
          </div>
        </div>
        <nav className="header-actions" aria-label="アプリメニュー">
          <button
            type="button"
            className="header-button"
            aria-label="Archive"
            onClick={() => {
              setArchiveOpen(true);
              void loadArchives();
            }}
          >
            <ArchiveIcon size={17} aria-hidden="true" />
            <span>Archive</span>
            {archives.length > 0 && <b>{archives.length}</b>}
          </button>
          <button
            type="button"
            className="header-button"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon size={17} aria-hidden="true" />
            <span>Settings</span>
          </button>
        </nav>
      </header>

      <main className="workspace">
        <div className="stage-column">
          <CharacterStage
            key={settings.characterImageUrl}
            idleVideoUrl={idleVideoUrl}
            characterName={characterDisplayName}
            imageUrl={characterDisplayImageUrl}
            videoUrl={currentVideoUrl}
            playbackKey={videoPlaybackKey}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <div className="stage-caption">
            <div>
              <span className="stage-caption-label">NOW TALKING WITH</span>
              <strong>{characterDisplayName}</strong>
            </div>
            <span className="model-chip">H3 Max · {settings.resolution}</span>
          </div>
        </div>

        <section className="chat-panel" aria-label="チャット">
          <header className="chat-header">
            <div>
              <MessageCircleMore size={18} aria-hidden="true" />
              <strong>Conversation</strong>
            </div>
            <span>{messages.length} messages</span>
          </header>

          <div className="chat-history" aria-live="polite">
            {messages.length === 0 ? (
              <div className="chat-welcome">
                <span>
                  <Sparkles size={22} aria-hidden="true" />
                </span>
                <strong>{characterDisplayName}と話してみましょう</strong>
                <p>
                  返答は短い音声付き動画になり、完成後はローカルアーカイブへ保存されます。
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  avatarUrl={characterDisplayImageUrl}
                  characterName={characterDisplayName}
                  onPlayVideo={playVideo}
                />
              ))
            )}

            <div ref={chatEndRef} />
          </div>

          {isBusy && (
            <div className="chat-generation-status" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <span>{statusLabel}</span>
            </div>
          )}

          {(error || idleError) && (
            <div className="error-banner" role="alert">
              <span>{error || idleError}</span>
              <button type="button" onClick={() => { setError(""); setIdleError(""); }}>
                <X size={16} aria-hidden="true" />
                <span className="sr-only">閉じる</span>
              </button>
            </div>
          )}

          {!ready && (
            <button
              type="button"
              className="setup-notice"
              onClick={() => setSettingsOpen(true)}
            >
              <span className="notice-dot" aria-hidden="true" />
              キャラクター画像とfal API Keyを設定してください
            </button>
          )}

          <ChatComposer disabled={isBusy} onSend={handleSend} />
          <p className="composer-note">
            Enterで送信 · Shift + Enterで改行 · 送信ごとに動画生成料金が発生します
          </p>
        </section>
      </main>

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        saving={savingSettings}
        busy={isBusy}
        idleGenerating={idleGenerating}
        idleStatus={idleGenerating || idleApplying ? statusLabel : ""}
        idleCandidate={idleCandidates[settings.characterImageUrl]}
        onApplyIdle={handleApplyIdle}
        idleError={idleError}
        onGenerateIdle={handleGenerateIdle}
        error={settingsError}
        llmModels={llmModels}
        llmModelsLoading={llmModelsLoading}
        llmModelsError={llmModelsError}
        referenceImages={referenceImages}
        referenceImagesLoading={referenceImagesLoading}
        referenceImagesError={referenceImagesError}
        onRefreshModels={loadLlmModelCatalog}
        onRefreshReferenceImages={loadReferenceImages}
        onClose={() => {
          if (!savingSettings) setSettingsOpen(false);
        }}
        onSave={handleSaveSettings}
        onReset={handleResetSettings}
      />

      <ArchiveDrawer
        open={archiveOpen}
        entries={archives}
        loading={archiveLoading}
        error={archiveError}
        onClose={() => setArchiveOpen(false)}
        onPlay={playArchive}
        onApplyIdle={handleApplyIdle}
        imageUrl={settings.characterImageUrl}
        idleVideoUrl={idleVideoUrl}
        busy={isBusy || savingSettings}
        applyError={idleError}
        applyStatus={idleApplying ? statusLabel : ""}
      />
    </div>
  );
}

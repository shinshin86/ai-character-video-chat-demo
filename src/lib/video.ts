import type { AppSettings, ArchiveEntry, CharacterReply } from "../types";
import { readJsonError } from "./errors";
import { DEFAULT_IDLE_PROMPT, MAX_IDLE_PROMPT_LENGTH } from "./idleMotion";

export function buildVideoPrompt(
  reply: string,
  performance: Pick<CharacterReply, "action" | "expression"> = { action: "", expression: "" },
): string {
  const quotedReply = JSON.stringify(reply.trim());
  const action = performance.action.trim();
  const expression = performance.expression.trim();
  return `Preserve the character's identity, appearance, outfit, hairstyle, facial features, and original visual style from the reference image.

The character looks toward the camera and says in Japanese:
${quotedReply}

Visual performance directions (do not speak these directions):
${action ? `Action: ${action}\nPerform this gesture visibly while speaking; allow the necessary arm, hand, and upper body movement.` : "Natural speaking motion with very subtle head and upper body movement."}
${expression ? `Facial expression: ${expression}` : "Subtle facial expressions matching the dialogue."}

Accurate lip synced Japanese dialogue.
Clear native audio with no music.
Natural blinking.
Keep the camera mostly static.
Start and finish in the neutral pose of the reference image, with hands at rest and mouth closed.
Preserve the original background and composition as much as possible.
If the reference is anime or illustration, preserve that exact visual style and do not make it photorealistic.
If the reference is a real person, preserve their appearance and clothing.
Do not add subtitles.
Do not add text.
Do not add other people.
Do not change the character design.`;
}

export function buildIdleVideoPrompt(prompt = DEFAULT_IDLE_PROMPT): string {
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length > MAX_IDLE_PROMPT_LENGTH) {
    throw new Error(`アイドルモーションのプロンプトを1〜${MAX_IDLE_PROMPT_LENGTH}文字で入力してください。`);
  }
  return trimmed;
}

type VideoStreamEvent =
  | {
      type: "status";
      status: string;
      message?: string;
    }
  | {
      type: "result";
      archive: ArchiveEntry;
    }
  | {
      type: "error";
      message: string;
    };

interface GenerateVideoOptions {
  settings: AppSettings;
  userMessage?: string;
  assistantReply?: string;
  performance?: Pick<CharacterReply, "action" | "expression">;
  kind?: "reply" | "idle";
  idlePrompt?: string;
  onStatus: (status: string, message?: string) => void;
}

export async function generateAndArchiveVideo({
  settings,
  userMessage = "",
  assistantReply = "",
  kind = "reply",
  idlePrompt,
  performance,
  onStatus,
}: GenerateVideoOptions): Promise<ArchiveEntry> {
  const prompt = kind === "idle" ? buildIdleVideoPrompt(idlePrompt) : buildVideoPrompt(assistantReply, performance);
  const response = await fetch("/api/fal/generate-video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.falApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind,
      imageUrl: settings.characterImageUrl,
      prompt,
      resolution: settings.resolution,
      videoModel: settings.videoModel,
      characterName: settings.characterName,
      userMessage,
      assistantReply,
      llmModel: settings.llmModel,
    }),
  });

  if (!response.ok) {
    throw new Error(await readJsonError(response));
  }
  if (!response.body) {
    throw new Error("動画生成の進捗を受信できませんでした。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let archive: ArchiveEntry | undefined;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as VideoStreamEvent;
    if (event.type === "status") {
      onStatus(event.status, event.message);
    } else if (event.type === "error") {
      throw new Error(event.message);
    } else {
      archive = event.archive;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handleLine);
    if (done) break;
  }
  handleLine(buffer);

  if (!archive) {
    throw new Error("生成動画の保存結果を取得できませんでした。");
  }
  return archive;
}

export function preloadVideo(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const timeout = window.setTimeout(() => finish(new Error("動画の読み込みがタイムアウトしました。もう一度お試しください。")), 30_000);
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      video.onloadeddata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      if (error) reject(error);
      else resolve();
    };
    video.preload = "auto";
    video.muted = true;
    video.onloadeddata = () => finish();
    video.onerror = () => finish(new Error("生成した動画を再生できませんでした。現在の待ち受けを維持します。"));
    video.src = url;
    video.load();
  });
}

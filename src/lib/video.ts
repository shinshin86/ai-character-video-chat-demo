import type { AppSettings, ArchiveEntry, CharacterReply } from "../types";
import { readJsonError } from "./errors";

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
Preserve the original background and composition as much as possible.
If the reference is anime or illustration, preserve that exact visual style and do not make it photorealistic.
If the reference is a real person, preserve their appearance and clothing.
Do not add subtitles.
Do not add text.
Do not add other people.
Do not change the character design.`;
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
  userMessage: string;
  assistantReply: string;
  performance: Pick<CharacterReply, "action" | "expression">;
  onStatus: (status: string, message?: string) => void;
}

export async function generateAndArchiveVideo({
  settings,
  userMessage,
  assistantReply,
  performance,
  onStatus,
}: GenerateVideoOptions): Promise<ArchiveEntry> {
  const prompt = buildVideoPrompt(assistantReply, performance);
  const response = await fetch("/api/fal/generate-video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.falApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imageUrl: settings.characterImageUrl,
      prompt,
      resolution: settings.resolution,
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

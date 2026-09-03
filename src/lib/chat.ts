import type { AppSettings, ChatMessage } from "../types";
import { readJsonError } from "./errors";

type CompletionContent =
  | string
  | Array<{ type?: string; text?: string }>
  | null;

interface FalChatCompletion {
  choices?: Array<{
    message?: { content?: CompletionContent };
    text?: string;
  }>;
  data?: { output?: string };
  output?: string;
}

export function buildSystemPrompt(settings: AppSettings): string {
  const characterName = settings.characterName.trim();
  const characterPersona = settings.characterPersona.trim();
  const identity = characterName
    ? `あなたは「${characterName}」として会話します。`
    : "あなたはユーザーが設定したAIキャラクターとして会話します。";
  const persona = characterPersona
    ? `\n\nCharacter Persona:\n${characterPersona}`
    : "";

  return `${identity}${persona}

次のルールを必ず守ってください。
- ユーザーが設定したキャラクターとして振る舞う
- Character Personaが設定されている場合は、その内容に従う
- ユーザーと自然な日本語で会話する
- 返答は原則1文、長くても2文にする
- 5秒程度で自然に発話できる20〜35文字程度を最優先する
- 説明文や話者名を書かず、セリフだけを返す
- Markdown、箇条書き、引用符を使わない
- キャラクターになりきる`;
}

export function normalizeReply(value: string): string {
  const normalized = value
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/\r?\n+/g, " ")
    .trim()
    .replace(/^[「『\"']|[」』\"']$/g, "")
    .trim();

  if (!normalized) {
    throw new Error("AIから空の返答が返されました。もう一度お試しください。");
  }
  return normalized;
}

export function extractAssistantText(payload: FalChatCompletion): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
  }
  if (typeof payload.choices?.[0]?.text === "string") {
    return payload.choices[0].text;
  }
  if (typeof payload.data?.output === "string") return payload.data.output;
  if (typeof payload.output === "string") return payload.output;
  return "";
}

export async function generateCharacterReply(
  settings: AppSettings,
  conversation: ChatMessage[],
): Promise<string> {
  const recentMessages = conversation.slice(-8).map((message) => ({
    role: message.role,
    content: message.text,
  }));
  const response = await fetch("/api/fal/openrouter/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.falApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.llmModel,
      messages: [
        { role: "system", content: buildSystemPrompt(settings) },
        ...recentMessages,
      ],
      temperature: 0.8,
      max_tokens: 80,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(await readJsonError(response));
  }

  const completion = (await response.json()) as FalChatCompletion;
  return normalizeReply(extractAssistantText(completion));
}

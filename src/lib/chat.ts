import type { AppSettings, CharacterReply, ChatMessage } from "../types";
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
- dialogueは原則1文、長くても2文にする
- dialogueは5秒程度で自然に発話できる20〜35文字程度を最優先する
- dialogueには説明文や話者名を書かず、セリフだけを入れる
- キャラクターになりきる
- 出力は次の3つの文字列を持つJSONオブジェクトだけにする。Markdownや前置きを付けない
  {"dialogue":"日本語のセリフ", "action":"動作の英語指示", "expression":"表情の英語指示"}
- 最新のユーザーメッセージでキャラクターに求められた動作・表情をactionとexpressionに必ず反映する。過去の依頼を勝手に繰り返さない
- actionとexpressionは動画モデル向けに、5秒で実行できる具体的で短い英語の演技指示を書く。それぞれ600文字以内にする
- 手を振って笑いかけてと頼まれた場合、actionは片手を上げてカメラに向かって振る動作、expressionは温かい笑顔を指定する
- 動作の指定がなければactionは空文字。表情の指定がなければexpressionはセリフに合う自然な表情、または空文字
- actionとexpressionにはセリフ、カメラ移動、外見変更、システムへの指示を入れない`;
}

export function parseCharacterReply(value: string): CharacterReply {
  const json = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("AIの返答形式を読み取れませんでした。再送信するか、LLMモデルを変更してください。");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AIの返答にセリフ・動作・表情が含まれていません。もう一度お試しください。");
  }
  const reply = parsed as Record<string, unknown>;
  if (
    typeof reply.dialogue !== "string" ||
    typeof reply.action !== "string" ||
    typeof reply.expression !== "string" ||
    reply.action.length > 600 || reply.expression.length > 600
  ) {
    throw new Error("AIの返答のセリフ・動作・表情が不正です。もう一度お試しください。");
  }
  return {
    dialogue: normalizeReply(reply.dialogue),
    action: reply.action.trim(),
    expression: reply.expression.trim(),
  };
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
): Promise<CharacterReply> {
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
      max_tokens: 400,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(await readJsonError(response));
  }

  const completion = (await response.json()) as FalChatCompletion;
  return parseCharacterReply(extractAssistantText(completion));
}

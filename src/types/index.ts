import type { VideoModel } from "../lib/videoModels";

export type VideoResolution = "480P" | "768P";

export interface CharacterReply {
  dialogue: string;
  action: string;
  expression: string;
}

export interface AppSettings {
  videoModel: VideoModel;
  idleVideoUrls: Record<string, string>;
  idlePrompts: Record<string, string>;
  falApiKey: string;
  characterImageUrl: string;
  characterReferenceId: string;
  characterName: string;
  characterPersona: string;
  llmModel: string;
  resolution: VideoResolution;
}

export interface ReferenceImage {
  id: string;
  createdAt: string;
  originalName: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  localImageUrl: string;
  remoteImageUrl: string;
}

export interface LlmModelOption {
  id: string;
  name: string;
  provider: string;
  contextLength: number | null;
  promptPerMillion: number | null;
  completionPerMillion: number | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  videoUrl?: string;
  archiveId?: string;
}

export interface ArchiveEntry {
  videoModel?: VideoModel;
  kind?: "reply" | "idle";
  sourceImageUrl?: string;
  id: string;
  createdAt: string;
  characterName: string;
  userMessage: string;
  assistantReply: string;
  videoPrompt: string;
  llmModel: string;
  resolution: VideoResolution;
  localVideoUrl: string;
  remoteVideoUrl: string;
  falRequestId: string;
}

export type GenerationPhase =
  | "idle"
  | "thinking"
  | "generating"
  | "archiving";

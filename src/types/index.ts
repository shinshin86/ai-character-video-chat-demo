export type VideoResolution = "480P" | "768P";

export interface AppSettings {
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

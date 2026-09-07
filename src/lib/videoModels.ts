export const VIDEO_MODELS = {
  "h3-max": {
    label: "MiniMax H3 Max",
    endpoint: "minimax/h3-max/image-to-video",
  },
  "h3-max-turbo": {
    label: "MiniMax H3 Max Turbo",
    endpoint: "minimax/h3-max-turbo/image-to-video",
  },
} as const;

export type VideoModel = keyof typeof VIDEO_MODELS;
export const DEFAULT_VIDEO_MODEL: VideoModel = "h3-max";

export function isVideoModel(value: unknown): value is VideoModel {
  return value === "h3-max" || value === "h3-max-turbo";
}

export function normalizeVideoModel(value: unknown, fallback: VideoModel = DEFAULT_VIDEO_MODEL): VideoModel {
  return isVideoModel(value) ? value : fallback;
}

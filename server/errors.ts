import { ApiError, ValidationError } from "@fal-ai/client";

export function toPublicErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    return "入力内容を確認してください。画像形式や動画設定が対応範囲外の可能性があります。";
  }

  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "fal API Keyを確認してください。";
    }
    if (error.status === 422) {
      return "falが入力を処理できませんでした。画像や返答内容を変更して再試行してください。";
    }
    if (error.status === 429) {
      return "falの利用上限に達しました。しばらく待ってから再試行してください。";
    }
    return "falへのリクエストに失敗しました。時間をおいて再試行してください。";
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return "処理がタイムアウトしました。時間をおいて再試行してください。";
  }

  return "処理中に予期しないエラーが発生しました。再試行してください。";
}

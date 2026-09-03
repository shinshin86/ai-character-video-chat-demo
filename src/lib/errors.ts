export function getErrorMessage(
  error: unknown,
  fallback = "処理に失敗しました。もう一度お試しください。",
): string {
  if (error instanceof Error) {
    if (/401|403|unauthorized|api key/i.test(error.message)) {
      return "fal API Keyを確認してください。";
    }
    if (/network|fetch|failed to fetch/i.test(error.message)) {
      return "ネットワークに接続できませんでした。接続を確認して再試行してください。";
    }
    if (error.message.trim()) {
      return error.message;
    }
  }
  return fallback;
}

export async function readJsonError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `リクエストに失敗しました（${response.status}）。`;
  } catch {
    return `リクエストに失敗しました（${response.status}）。`;
  }
}

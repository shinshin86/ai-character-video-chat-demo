import type { YouTubeControl } from "../hooks/useYouTube";
import { youtubeVideoId, type YouTubeSettings as Settings } from "../lib/youtube";

export function YouTubeFields({ value, onChange }: { value: Settings; onChange: (value: Settings) => void }) {
  return <section className="youtube-settings" aria-label="YouTube配信設定">
    <h3>YouTube Live</h3>
    <p className="field-hint">OBSなどでこの画面と音声を配信し、視聴者コメントに自動返答します。</p>
    <div className="field-group"><label htmlFor="youtube-key">YouTube API Key</label>
      <input id="youtube-key" type="password" autoComplete="off" spellCheck={false} value={value.apiKey} onChange={(e) => onChange({ ...value, apiKey: e.target.value })} />
    </div>
    <div className="field-group"><label htmlFor="youtube-url">YouTube配信URL / 動画ID</label>
      <input id="youtube-url" value={value.liveUrl} onChange={(e) => onChange({ ...value, liveUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
      {value.liveUrl && !youtubeVideoId(value.liveUrl) && <p className="field-hint">正しい配信URLまたは11文字の動画IDを入力してください。</p>}
    </div>
    <div className="field-group"><label htmlFor="youtube-interval">コメント取得間隔</label>
      <select id="youtube-interval" value={value.intervalSeconds} onChange={(e) => onChange({ ...value, intervalSeconds: Number(e.target.value) })}>
        {[10,20,30,60].map((n) => <option value={n} key={n}>{n}秒</option>)}
      </select>
    </div>
    <p className="field-hint">APIキーはこのブラウザ内に保存します。Save Changesで保存後、Settingsを再度開いて取得を開始してください。YouTube指定の取得間隔が長い場合はそちらを優先します。</p>
  </section>;
}

export function YouTubeMonitor({ control, canStart }: { control: YouTubeControl; canStart: boolean }) {
  return <section className="youtube-monitor" aria-label="YouTube接続状態">
    <strong>YouTube：{control.status} · 待機 {control.pending}件</strong>
    {control.lastComment && <p className="field-hint">最後の受信：{control.lastComment.author}「{control.lastComment.text}」</p>}
    {control.dropped > 0 && <p className="field-hint">期限・上限により除外：{control.dropped}件</p>}
    {control.error && <p className="inline-error" role="alert">{control.error}</p>}
    <button className="secondary-button" type="button" disabled={!control.running && !canStart} onClick={() => control.running ? control.stop() : control.start()}>
      {control.running ? "コメント取得を停止" : "コメント取得を開始"}
    </button>
    <p className="field-hint">接続後の新着コメントが対象です。Settingsを閉じると順番に返答します。返答ごとに動画生成料金が発生します。停止時は待機列を消去し、生成中・再生中の返答は完了まで続きます。</p>
  </section>;
}

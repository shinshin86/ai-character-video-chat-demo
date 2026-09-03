# AI Character Video Chat Demo

[English](README.md) | 日本語

![AIキャラクター動画チャットのデモ画面](docs/demo.png)

好きな人物・アニメ・イラストの画像を設定し、AIキャラクターの返答を音声付きの短い動画として再生するローカルデモです。

LLMの会話処理にはfal.aiのOpenRouter endpoint、動画生成にはfal.aiのMiniMax H3 Maxを使用します。1つのfal API Keyで両方を利用でき、生成した動画と、そのときの質問・返答・生成条件はローカルに保存されます。

## What this is

このアプリはfal.ai H3 MaxのImage-to-Video APIを体験するためのローカルサンプルです。

1. fal OpenRouterがキャラクターとしての短い返答を生成
2. MiniMax H3 Maxがキャラクター画像と返答から音声付き動画を生成
3. ローカルサーバーが動画をダウンロードし、会話メタデータと一緒に保存
4. ブラウザ上で再生し、Archiveから過去の生成結果を参照

実写人物、アニメキャラクター、イラストで利用できます。正面または正面に近い顔画像が会話動画に適しています。

## Setup

Node.js 20.19以上、または22.12以上が必要です。

```bash
git clone https://github.com/shinshin86/ai-character-video-chat-demo.git
cd ai-character-video-chat-demo
npm install
npm run dev
```

ブラウザで `http://127.0.0.1:5180` を開きます。別のポートを使う場合は `PORT` 環境変数で変更できます。

## How to use

1. Settingsを開く
2. fal API Keyを入力
3. 新しいCharacter Imageをアップロードするか、Saved Imagesから選択
4. 必要に応じてCharacter NameとCharacter Personaを設定
5. fal LLM Modelをセレクトボックスから選択
6. チャットを送信
7. AIの短い返答と動画生成を待つ
8. 完成した動画を再生する
9. Archiveから過去の質問・返答・動画を確認し、必要なMP4をダウンロードする

API Keyがなくてもアプリの起動、設定画面、空のArchiveは確認できます。実際の画像アップロード・LLM返答・動画生成には有効なfal API Keyと利用可能なクレジットが必要です。

Character NameとCharacter Personaは任意です。初期状態では固有のキャラクター名・性別・人格を設定していません。

## First chat recipe

初めて試す場合は、次の設定から始められます。

1. 正面または正面に近い、顔と口元がはっきり見える画像を用意する
2. Settingsでfal API KeyとCharacter Imageを設定する
3. Character Personaへ、会話の雰囲気や返答の長さを記入する
4. 最初は480Pを選び、短いメッセージを送信する
5. 動画が完成したら、返答内容と映像を確認する

Character Personaの記入例です。これは設定例であり、アプリに固定されたキャラクター設定ではありません。

```text
明るく親しみやすい女の子。
友達のように自然な日本語で会話する。
返答は短く、少し感情豊かに話す。
```

性別、性格、口調、関係性、返答の長さなどを、使いたいキャラクターに合わせて自由に変更してください。最初のメッセージは「こんにちは。今日はどんな気分？」のような短い文章がおすすめです。

## Preparing a reference image

三面図や全身画像しかない場合は、画像生成サービスで会話画面向けの1枚を作ってからCharacter Imageへ設定できます。次のプロンプトは、実写・アニメ・イラストのいずれにも使える例です。

```text
添付したキャラクターデザインを参照し、同じキャラクターの会話用画像を1枚作成してください。

元画像の顔、髪型、衣装、配色、表現スタイルを維持してください。
16:10の横長画像で、キャラクターを中央に配置した腰から上の正面構図にしてください。
カメラを見ながら自然に話し始めるように、親しみやすい表情で口を少し開けてください。
顔と口元は大きく明瞭にし、中央の4:5範囲に重要部分を収めてください。
背景はシンプルにして、キャラクターより目立たせないでください。
三面図をそのまま並べず、正面を向いた1人だけを描いてください。
字幕、吹き出し、UI、透かし、不要な文字を追加しないでください。
```

16:10にしておくと画面へ収まりやすく、中央の4:5範囲に顔と口元を置くと、画面幅が狭い場合にも重要部分が切れにくくなります。

## Chat input

- Enterで送信します。
- Shift + Enterで改行します。
- 日本語入力などの変換中に押したEnterは変換確定に使われ、メッセージを送信しません。
- 画面上の送信ボタンからも送信できます。

## APIs used

### LLM

```text
https://fal.run/openrouter/router/openai/v1/chat/completions
```

ブラウザからローカルサーバーを経由し、falのOpenAI互換endpointへ直接接続します。追加のLLMライブラリは使用しません。デフォルトモデルは次のとおりです。

```text
google/gemini-2.5-flash
```

Settingsのモデル一覧は、ローカルサーバーがOpenRouterの公開モデルカタログから取得し、テキスト入出力に対応したモデルを表示します。モデルカタログの取得にOpenRouter API Keyは不要で、実際の会話生成は選択したモデルIDをfalへ送信します。表示する単価は公開カタログの参考値で、実際の請求はfalの利用明細を確認してください。

fal API Keyは[fal Dashboard](https://fal.ai/dashboard/keys)で作成できます。キーはソースコードや`.env`へ書き込まず、Settingsから入力してください。

### Video

```text
minimax/h3-max/image-to-video
```

動画は5秒固定です。480Pまたは768PをSettingsで選択できます。

### Image upload

キャラクター画像はローカルのリファレンスライブラリへ保存し、`@fal-ai/client` の `fal.storage.upload()` 相当の処理でfal CDNへ一度だけアップロードします。同じ画像を再び選択した場合は、ローカル画像と保存済みfal URLを再利用します。

### Reference images

アップロードしたキャラクター画像とローカル索引は、次のGit管理外ディレクトリに保存します。

```text
data/reference/images/
data/reference/index.json
```

SettingsのSaved Imagesには保存済み画像がサムネイル表示され、アプリを再起動した後も選択できます。画像ファイル、元のファイル名、fal URLは`data/`配下だけに保存され、Gitには含まれません。

## Local archive

生成動画はローカルサーバーがfal CDNから取得し、次のGit管理外ディレクトリに保存します。

```text
data/archive/videos/
data/archive/index.json
```

`index.json` にはキャラクター名、ユーザーの発言、AIの返答、LLMモデル、解像度、H3 Maxへ送ったプロンプト、fal request ID、動画URLが記録されます。

会話内容を残したくない場合は、サーバーを停止してから `data/archive/` の内容を削除してください。この操作はアプリ画面からは行いません。

Settingsの `Reset Settings` はブラウザの設定だけを消去し、ローカル動画や保存済みのリファレンス画像は削除しません。

## Important Security Notice

> この実装はローカルデモ専用です。公開WebサービスではAPIキーをフロントエンドやlocalStorageに置かず、認証されたサーバー側のプロキシを使用してください。

- fal API KeyはブラウザのlocalStorageに保存され、API呼び出し時だけ同一オリジンのローカルサーバーへ送信されます。
- ローカルサーバーはAPI Keyをファイルへ保存せず、ログにも出力しません。
- fal CDNへアップロードした入力画像と生成直後のリモート動画URLは、URLを知っている人がアクセスできる場合があります。
- チャット本文はReactの通常のテキスト描画を使用し、`dangerouslySetInnerHTML` は使用していません。
- このサーバーは `127.0.0.1` のみにbindします。外部公開を前提とした認証・アクセス制御は備えていません。

## Notes

- 動画生成とLLM利用にはfal.aiの利用料金が発生します。LLM料金は選択モデルごとに異なります。
- コストと速度を優先する場合は480Pが向いています。
- 生成結果は入力画像、プロンプト、モデルの状態によって変わります。
- 音声付き動画の自動再生はブラウザに拒否される場合があります。その場合も動画のcontrolsから手動再生できます。
- 日本語音声とリップシンクの品質は入力画像やセリフに依存します。
- ArchiveはこのPC上のデータです。別PCや別cloneには自動同期されません。

## Commands

```bash
npm run dev        # ローカルサーバー + Vite開発環境
npm run typecheck  # フロントエンドとサーバーの型検査
npm test           # APIを呼ばないユニットテスト
npm run build      # 型検査 + 本番用フロントエンドbuild
npm start          # build済みのdistをローカル配信
```

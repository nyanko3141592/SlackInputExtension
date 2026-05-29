# Chrome Web Store 掲載用テキスト

ストア審査・公開時にコピー＆ペーストで使えるテキスト集。v0.5.x 系で更新済み。

## 拡張機能名

```
Slack AI Rewriter
```

## 概要（132 文字以内・必須）

```
SlackをAIで瞬時にリライト・音声入力。丁寧/整理/構造化/英訳など複数プロンプト、辞書機能でカナ→正式表記。Slack Markdown完全準拠。
```

## 詳細な説明（最大 16,000 文字）

```
✨ Slack AI Rewriter は、Slack の Web 版メッセージ入力欄でテキストをワンクリックで AI リライト・音声入力できる Chrome 拡張機能です。Google の Gemini AI が書きかけの文章を「丁寧に」「わかりやすく」「構造化」など、目的に応じて瞬時に整形します。

━━━━━━━━━━━━━━━━━━
■ こんな悩みを解決
━━━━━━━━━━━━━━━━━━

- 急いで書いたメッセージを送る前に「丁寧にしたい」
- 長文を分かりやすく整理してから送りたい
- 報告・依頼を構造化したい
- 日本語を自然な英語に翻訳して送りたい
- キーボードを打たずに音声で本文を書きたい
- 同じ修正を何度も手作業でやっている
- 「co fount」→「CoeFont」のような固有名詞の表記揺れを統一したい

━━━━━━━━━━━━━━━━━━
■ 主な機能
━━━━━━━━━━━━━━━━━━

【1. ワンクリックリライト】
- Slack の送信ボタンの隣に AI ストリップが常時表示
- 「指示を書いて Enter」だけで即リライト
- 結果は入力欄に直接置換、プレビュー画面なしで素早い

【2. プリセットプロンプト 7 種類】
- 🙇 丁寧にリライト
- 🧹 わかりやすく整理
- 🗂️ 構造化
- ✂️ 簡潔化
- 😊 カジュアル化
- • 箇条書きに変換
- 🌐 英語に変換
- 必要に応じて自由に追加・編集可能

【3. ワンショット指示】
- 自由形式で「もっと丁寧に」「絵文字減らして」など書いて即実行
- textarea で複数行入力可能（Shift+Enter で改行 / Enter で実行）

【4. 音声入力】
- 🎤 ボタンで Slack 入力欄に音声で本文を書ける
- 録音中はマイクボタンが入力ボリュームに応じて脈動するビジュアルフィードバック
- 最大 5 分で自動停止（残り 30 秒で警告表示）
- Gemini が自然な日本語に整形して入力欄に追記

【5. 重ねがけ & 履歴】
- リライト結果にさらに別の指示を重ねがけ可能
- ↩ で 1 つ前に戻す / ⟲ で AI 実行前の原型に戻す

【6. 辞書機能 (誤変換対策)】
- 「読み (reading)」と「表示 (display)」のマッピングを登録
- リライト・音声文字起こし両方で自動置換
- CSV インポート / エクスポートに対応 (UTF-8、Excel 互換)
- 社内固有の略語・製品名・人名の表記揺れを一括統一できる

【7. Slack Markdown 完全準拠】
- *太字* / _斜体_ / ~取消線~ / `コード` / 箇条書き「• 」
- メンション <@USER>、URL、絵文字ショートコード :smile: は自動で保持
- 標準 Markdown の **bold** などは出力しない

【8. メイン入力欄 / スレッド / DM 対応】
- どこでも同じ操作で AI リライト
- 各入力欄に独立したセッション履歴

【9. 豊富なキーボードショートカット】
- Alt+Shift+A: AI 指示入力にフォーカス
- Alt+Shift+R: 直前のプロンプトを再実行
- Alt+Shift+1〜9: プロンプトを直接実行
- カスタマイズ可（chrome://extensions/shortcuts）

【10. 2 つの接続モード】
- 直接モード: 自分の Gemini API キーを入力して使う（個人利用向け）
- Gateway モード: 組織で運営する Cloudflare Worker 経由で利用（チーム利用向け、API キー不要）

━━━━━━━━━━━━━━━━━━
■ 利用方法
━━━━━━━━━━━━━━━━━━

1. 拡張機能をインストール
2. Google AI Studio (https://aistudio.google.com/app/apikey) で無料の Gemini API キーを取得
3. 拡張機能アイコンから設定画面を開き、API キーを入力して保存
4. Slack の Web 版を開いてメッセージを書く
5. 送信ボタンの隣にあるストリップに「もっと丁寧に」などの指示を書いて Enter

━━━━━━━━━━━━━━━━━━
■ Slack 側の推奨設定
━━━━━━━━━━━━━━━━━━

Slack の「環境設定 → 詳細設定 → メッセージ作成」で
「マークアップでメッセージをフォーマットする」を ON にすると、
*太字* などの記法がそのまま太字として送信されます。

━━━━━━━━━━━━━━━━━━
■ 対応モデル
━━━━━━━━━━━━━━━━━━

任意の Gemini モデル名を直接入力可能。プリセット候補:
- Gemini 2.5 Flash Lite（デフォルト・最速）
- Gemini 3 Flash preview
- Gemini 3 Pro preview（高品質）
- Gemini 2.5 Flash（バランス）
- Gemini 2.5 Pro（高品質・遅め）

新しいモデルが Google からリリースされた際は、popup でモデル名を直接入力して即試せます。

━━━━━━━━━━━━━━━━━━
■ プライバシー
━━━━━━━━━━━━━━━━━━

- 書きかけのテキストおよび録音した音声は、あなたがリライト/音声入力ボタンを押した時にのみ Gemini API（または設定した Gateway）に送信されます
- API キー・Gateway URL・メンバートークン・プロンプト・モデル選択はあなたの Chrome 内（chrome.storage.sync）に保存
- 辞書は端末ローカル（chrome.storage.local）に保存（同期されず、各 PC で個別に管理）
- 拡張機能の運営者がデータを収集・保管することは一切ありません
- Slack 以外のサイトでは一切動作しません
- 詳細: https://github.com/nyanko3141592/SlackInputExtension/blob/main/PRIVACY.md

━━━━━━━━━━━━━━━━━━
■ オープンソース
━━━━━━━━━━━━━━━━━━

ソースコードは MIT ライセンスで公開しています。
https://github.com/nyanko3141592/SlackInputExtension

━━━━━━━━━━━━━━━━━━
■ サポート
━━━━━━━━━━━━━━━━━━

不具合報告・機能要望は GitHub Issues までお願いします。
https://github.com/nyanko3141592/SlackInputExtension/issues
```

## カテゴリ

- 生産性（Productivity）

## 言語

- 日本語

## 単一目的の説明（Single Purpose）

```
Slack の Web 版メッセージ入力欄のテキストを Google Gemini AI でリライトすること、および音声入力で本文を起こすこと。
```

## 権限の正当化

### storage 権限

```
ユーザーの API キー、Gateway URL、メンバートークン、カスタムプロンプト、モデル選択、辞書をローカルに保存するために使用します。API キーなどの設定は chrome.storage.sync で端末間同期し、サイズの大きい辞書データは chrome.storage.local に格納します。
```

### host permission: generativelanguage.googleapis.com

```
Google Gemini API へリライト対象のテキスト・録音音声・プロンプトを送信し、結果を受け取るために必要です。これがリライトおよび音声入力機能の中核です。
```

### host permission: \*.workers.dev

```
オプションの Gateway モードで、ユーザーまたは組織が用意した Cloudflare Worker 経由で Gemini API を呼び出すために必要です。これにより組織内で API キーを共有することなく機能を利用できます。デフォルト設定では使用しません。
```

### content*scripts: https://\*.slack.com/*, https://app.slack.com/_

```
Slack の Web 版（app.slack.com および各ワークスペースの slack.com サブドメイン）のメッセージ入力欄に AI リライト UI を挿入するために必要です。Slack 以外の URL では一切動作しません。各メッセージの読み取り・送信は行わず、ユーザーが書きかけの入力欄のテキストのみを扱います。
```

### マイクへのアクセス (実行時にユーザーが許可)

```
音声入力機能（🎤 ボタン）でユーザーが録音を開始したときのみ、Web Audio API (MediaRecorder) を介してマイクから音声を取得します。マイクへのアクセスは Chrome のランタイム許可ダイアログで都度確認されます。録音した音声は Slack 入力欄への本文起こしのために Gemini API に送信され、拡張機能側で保存することはありません。
```

### リモートコードの使用

```
リモートコードは使用していません。すべての JavaScript は拡張機能パッケージに同梱されています。
```

### データ収集について（Privacy Practices Tab）

```
- Personally identifiable information（個人識別情報）: NO
- Health information: NO
- Financial and payment information: NO
- Authentication information: YES（ユーザーが入力した API キー / Gateway URL / メンバートークン。ローカル保存のみ、拡張機能運営者には送信されない）
- Personal communications: YES（ユーザーが Slack 入力欄に書いた書きかけのテキスト。リライトのため Gemini API に送信される）
- Location: NO
- Web history: NO
- User activity: NO
- Website content: NO
```

加えて、Web Store の「Why do you collect this data?」セクションで以下も該当:

```
- Audio (音声録音): YES — 🎤 ボタン押下時のみ、本文起こしのために Gemini API に送信
```

「I do not sell or transfer user data to third parties, outside of the approved use cases」「I do not use or transfer user data for purposes that are unrelated to my item's single purpose」「I do not use or transfer user data to determine creditworthiness or for lending purposes」のすべてにチェックを入れる。

## プライバシーポリシーの URL

```
https://github.com/nyanko3141592/SlackInputExtension/blob/main/PRIVACY.md
```

## サポート URL（任意）

```
https://github.com/nyanko3141592/SlackInputExtension/issues
```

## アップロード用素材

- アップロード ZIP: `dist/slack-ai-rewriter-v0.5.2.zip`（または以降の最新タグ）
- アイコン: `icons/icon128.png`（既存）
- 必要なスクリーンショット: 1280x800 または 640x400 を 1〜5 枚
  - 推奨: Slack 入力欄にストリップが表示された状態、プロンプト一覧、音声入力中、辞書タブ、設定画面、リライト前後の比較など

## 公開範囲

- 公開（Public）

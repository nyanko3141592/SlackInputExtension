# Chrome Web Store 掲載用テキスト

ストア審査・公開時にコピー＆ペーストで使えるテキスト集。

## 拡張機能名

```
Slack AI Rewriter
```

## 概要（132 文字以内・必須）

```
Slackの入力欄をAIで瞬時にリライト。丁寧/整理/構造化/英訳など複数プロンプトをワンタップ。Slack Markdownに完全準拠した自然な文章に。
```

## 詳細な説明（最大 16,000 文字）

```
✨ Slack AI Rewriter は、Slack の Web 版メッセージ入力欄でテキストをワンクリックで AI リライトできる Chrome 拡張機能です。Google の Gemini AI が書きかけの文章を「丁寧に」「わかりやすく」「構造化」など、目的に応じて瞬時に整形します。

━━━━━━━━━━━━━━━━━━
■ こんな悩みを解決
━━━━━━━━━━━━━━━━━━

- 急いで書いたメッセージを送る前に「丁寧にしたい」
- 長文を分かりやすく整理してから送りたい
- 報告・依頼を構造化したい
- 日本語を自然な英語に翻訳して送りたい
- 同じ修正を何度も手作業でやっている

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
- 気に入った指示はその場でプロンプトとして保存して再利用可能

【4. 重ねがけ & 履歴】
- リライト結果にさらに別の指示を重ねがけ可能
- ↩ で 1 つ前に戻す / ⟲ で AI 実行前の原型に戻す

【5. Slack Markdown 完全準拠】
- *太字* / _斜体_ / ~取消線~ / `コード` / 箇条書き「• 」
- メンション <@USER>、URL、絵文字ショートコード :smile: は自動で保持
- 標準 Markdown の **bold** などは出力しない

【6. メイン入力欄 / スレッド / DM 対応】
- どこでも同じ操作で AI リライト
- 各入力欄に独立したセッション履歴

【7. 豊富なキーボードショートカット】
- Alt+Shift+A: AI メニューを開く
- Alt+Shift+R: 直前のプロンプトを再実行
- Alt+Shift+1〜9: プロンプトを直接実行
- カスタマイズ可（chrome://extensions/shortcuts）

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

- Gemini 2.5 Flash（推奨・速い）
- Gemini 2.5 Flash Lite（より軽量）
- Gemini 2.5 Pro（高品質）

━━━━━━━━━━━━━━━━━━
■ プライバシー
━━━━━━━━━━━━━━━━━━

- 書きかけのテキストは、あなたが ✨ AI ボタンを押した時にのみ Gemini API に送信されます
- API キーやユーザー設定はあなたの Chrome 内（chrome.storage.sync）にのみ保存されます
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
Slack の Web 版メッセージ入力欄に書かれたテキストを、Google Gemini AI で目的別にリライトすること。
```

## 権限の正当化

### storage 権限
```
ユーザーの API キー、カスタムプロンプト、モデル選択をローカルに保存するために使用します。chrome.storage.sync を用いることでユーザーのデバイス間で設定を同期します。
```

### host permission: generativelanguage.googleapis.com
```
Google Gemini API へリライト対象のテキストとプロンプトを送信し、結果を受け取るために必要です。これがリライト機能の中核です。
```

### host permission: *.workers.dev
```
オプションの Gateway モードで、ユーザーまたは管理者が用意した Cloudflare Worker 経由で Gemini API を呼び出すために必要です。これにより組織内で API キーを共有することなく機能を利用できます。デフォルト設定では使用しません。
```

### content_scripts: https://*.slack.com/*, https://app.slack.com/*
```
Slack の Web 版（app.slack.com および各ワークスペースの slack.com サブドメイン）のメッセージ入力欄に AI リライト UI を挿入するために必要です。Slack 以外の URL では一切動作しません。各メッセージの読み取り・送信は行わず、ユーザーが書きかけの入力欄のテキストのみを扱います。
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
- Authentication information: YES（ユーザーが入力した API キー / Gateway URL。ローカル保存のみ、運営者には送信されない）
- Personal communications: YES（ユーザーが Slack 入力欄に書いた書きかけのテキスト。リライトのため Gemini API に送信される）
- Location: NO
- Web history: NO
- User activity: NO
- Website content: NO
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

- アイコン: `icons/icon128.png`（既存）
- 必要なスクリーンショット: 1280x800 または 640x400 を 1〜5 枚
  - 推奨: Slack 入力欄にストリップが表示された状態、プロンプト一覧、設定画面、リライト前後の比較など

## 公開範囲

- 公開（Public）

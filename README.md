# Slack AI Rewriter

Slack の Web 版メッセージ入力欄を、Google Gemini AI でその場リライトする Chrome 拡張機能。

- 送信ボタンの隣に **AI 指示ストリップ** が常時 inline 表示
- 「もっと丁寧に」など書いて **Enter で即リライト**（プレビューなし）
- **重ねがけ** で続けて別の指示を当てられる
- **↩ で 1 つ戻す / ⟲ で AI 実行前の原型に戻す**
- 出力は **Slack mrkdwn 形式**（`*太字*`, `_斜体_`, `• 箇条書き` 等）に準拠
- メンション・URL・絵文字ショートコードは保持
- メイン / スレッド / DM すべての入力欄で動作

## デフォルトのプロンプト

| アイコン | 名前 | 用途 |
|---|---|---|
| 🙇 | 丁寧にリライト | ビジネス向けに敬語で柔らかく |
| 🧹 | わかりやすく整理 | 長文を読みやすく整える |
| 🗂️ | 構造化 | 太字ラベル + 箇条書きでセクション分け |
| ✂️ | 簡潔化 | 1〜3 文に要約 |
| 😊 | カジュアル化 | フラットな社内チャット向け |
| • | 箇条書きに変換 | 要点を箇条書きで抽出 |
| 🌐 | 英語に変換 | 自然なビジネス英語に翻訳 |

`✨ AI ▾` ボタンから一覧を開いて選択 / 数字キー 1〜9 で直接実行 / popup から自由に追加・編集・並べ替え可能。

## インストール（開発者用）

Chrome Web Store 公開前は手動インストールが必要です。

1. このリポジトリを clone

   ```sh
   git clone https://github.com/nyanko3141592/SlackInputExtension.git
   cd SlackInputExtension
   ```

2. アイコンを生成（初回のみ）

   ```sh
   pnpm install
   pnpm build:icons
   ```

3. Chrome の `chrome://extensions/` を開く → デベロッパーモード ON
4. 「パッケージ化されていない拡張機能を読み込む」 → このフォルダを選択

## 初回設定

1. 拡張機能アイコンをクリック → popup
2. **API 設定** タブで Gemini API キーを入力（[Google AI Studio](https://aistudio.google.com/app/apikey) で無料発行可能）
3. **保存**

## Slack 側のおすすめ設定

Slack の `環境設定 → 詳細設定 → メッセージ作成` で

> **マークアップでメッセージをフォーマットする** を ON

これを ON にしないと AI が出力する `*太字*` 等の記法がそのまま文字として送信されてしまいます。

## 使い方

1. Slack でメッセージを書く
2. 送信ボタンの隣にあるストリップに「もっと丁寧に」などの指示を書いて Enter
3. 入力欄が直接置換される
4. 続けて別の指示を入力すれば重ねがけ
5. `↩` で 1 つ戻す、`⟲` で AI 実行前の原型に戻す
6. `✨ AI ▾` クリック または `↓` キーで保存済みプロンプト一覧

### 操作フロー（マウスレス）

1. Slack 入力欄に文章を書く
2. `Alt+Shift+A` で AI 指示入力欄にフォーカス
3. 「もっと丁寧に」と入力して Enter → リライト即適用
4. `Alt+Shift+R` で同じ指示をもう一発
5. `Alt+Shift+1` でプロンプト #1（丁寧にリライト）を実行
6. やりすぎたら `undo-rewrite` ショートカット（要バインド）で戻す

## キーボードショートカット

Chrome の標準ショートカットとして登録されているので、`chrome://extensions/shortcuts` で **自由にカスタマイズ可能**。

### 既定割当（Chrome 予約と衝突しない `Alt+Shift+` 系で統一）

| キー | 動作 |
|---|---|
| `Alt+Shift+A` | AI ストリップ入力欄にフォーカス |
| `Alt+Shift+R` | 直前と同じプロンプトでもう一度リライト |
| `Alt+Shift+1` | プロンプト #1 を直接実行 |
| `Alt+Shift+2` | プロンプト #2 を直接実行 |

> Mac では `Alt` = `Option` キー。`Cmd+Shift+...` 系は Chrome 予約（Downloads / DevTools / Tab 復元 / シークレットなど）と衝突するため避けています。

### 既定未割当（`chrome://extensions/shortcuts` で設定可）

| コマンド | 説明 |
|---|---|
| `rewrite-3` 〜 `rewrite-9` | プロンプト #3〜9 を直接実行 |
| `undo-rewrite` | 直前のリライトを取り消す（↩） |
| `reset-original` | 原型に戻す（⟲） |

### ストリップ内のキー

| キー | 動作 |
|---|---|
| `Enter` | 入力した指示で即リライト |
| `↓` | 保存済みプロンプト一覧を開く |
| `Esc` | プロンプト一覧を閉じる |
| `1`〜`9`（一覧オープン中） | プロンプトを直接実行 |

## カスタムプロンプト

popup の **プロンプト** タブから追加・編集・並び替え・削除ができます。
Slack mrkdwn の出力ルールは自動付与されるので、本文には「方針」だけ書けば OK。

例:
```
次の Slack メッセージを、新人にもわかるよう専門用語を平易な言葉に置き換えてリライトしてください。
```

## ファイル構成

```
manifest.json        MV3 manifest（slack.com のみで動作）
background.js        Gemini API 呼び出し、デフォルトプロンプト、ショートカットルーティング
content.js           Slack DOM 内に inline でストリップ注入
content.css          Shadow DOM 用 CSS（補助）
popup.html/js/css    設定 UI（API キー・プロンプト管理）
generate-icons.js    アイコン生成スクリプト
scripts/build-zip.js Web Store 用 zip パッケージング
icons/               16/48/128 PNG
LICENSE              MIT
PRIVACY.md           プライバシーポリシー
STORE_LISTING.md     Chrome Web Store 申請テキスト
```

## Web Store 用 ZIP のビルド

```sh
pnpm install   # 初回のみ
pnpm build:zip
```

`dist/slack-ai-rewriter-v{version}.zip` が生成されます。

## プライバシー

- 書きかけのテキストは、あなたが ✨ AI ボタンを押した時にのみ Gemini API に送信されます
- API キーやユーザー設定はあなたの Chrome 内（`chrome.storage.sync`）にのみ保存され、運営者には送信されません
- Slack 以外のサイトでは一切動作しません
- 詳細: [PRIVACY.md](./PRIVACY.md)

## 既知の制限

- Slack の React が DOM を頻繁に書き換えるため、稀にストリップが一瞬消えますが MutationObserver で再注入します
- 巨大入力（数千文字超）はモデルの `maxOutputTokens` (4096) を超えると切れる可能性があります
- ハドルやファイル添付付きメッセージのキャプションなど、特殊な入力欄では未検証です

## ライセンス

[MIT License](./LICENSE)

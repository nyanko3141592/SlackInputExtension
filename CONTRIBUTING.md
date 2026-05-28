# コントリビューションガイド

Slack AI Rewriter への貢献に興味を持ってくれてありがとう！

## ローカル環境セットアップ

```sh
git clone https://github.com/nyanko3141592/SlackInputExtension.git
cd SlackInputExtension
pnpm install
pnpm build:icons
```

Chrome の `chrome://extensions/` でデベロッパーモードを ON にして、このフォルダを「パッケージ化されていない拡張機能を読み込む」で読み込みます。

## 開発フロー

1. **Issue で議論** - 大きい変更はまず Issue を立てて方針を相談してください
2. **ブランチを切る** - `feature/xxx` / `fix/xxx` 等
3. **小さく変更** - 1 PR 1 目的が原則
4. **動作確認** - Slack で実際に動かして確認
5. **PR を出す** - PR テンプレートに従って記述

## コード規約

- **インデント**: 2 スペース
- **クォート**: シングル (`'`)
- **セミコロン**: あり
- **JS のみ** (TypeScript ビルドは導入していない、軽量に保つ)
- ESLint / Prettier は設定していないので、既存ファイルのスタイルに合わせて
- `console.log` は最小限に（`[SAIR]` プレフィックス推奨）
- Slack DOM の特定セレクタに依存する場合、複数の selector を並べてフォールバック

## アーキテクチャ概要

```
manifest.json    MV3 manifest, content_scripts は https://*.slack.com/* のみ
background.js    Gemini API 呼び出し、chrome.commands ハンドリング
content.js       Slack DOM 内に inline でストリップを注入。MutationObserver で再注入
popup.{html,js,css}  API キー / プロンプト管理 UI
```

### ストリップの仕組み

- `.c-wysiwyg_container__footer` の `.c-wysiwyg_container__suffix` (送信ボタン) の直前に inline 挿入
- `position: fixed` ではなく Slack の flex layout に乗っている → 位置計算不要
- プロンプト一覧ポップアップだけは `document.body` 直下に配置 (overflow:hidden 回避)
- フォーカスは blur 時に "ユーザークリック or React 自動" を判定して条件付き復帰

## リリースフロー (メンテナ向け)

1. `manifest.json` の `version` を更新 (例: `0.1.0` → `0.1.1`)
2. `CHANGELOG.md` を更新
3. コミット → `main` にマージ
4. タグを切る:
   ```sh
   git tag v0.1.1 && git push origin v0.1.1
   ```
5. GitHub Actions が自動で:
   - ZIP をビルド
   - GitHub Release を作成
   - `slack-ai-rewriter-vX.Y.Z.zip` を添付
6. Chrome Web Store devconsole で同じ ZIP をアップロード

## バグ報告 / 質問

- バグ: [Issue Bug Report](https://github.com/nyanko3141592/SlackInputExtension/issues/new?template=bug_report.md)
- 機能要望: [Issue Feature Request](https://github.com/nyanko3141592/SlackInputExtension/issues/new?template=feature_request.md)
- 質問: [Discussions](https://github.com/nyanko3141592/SlackInputExtension/discussions)

## ライセンス

このプロジェクトに貢献することは、コードが [MIT License](./LICENSE) の下で公開されることに同意したとみなされます。

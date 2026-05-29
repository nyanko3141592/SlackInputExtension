# Changelog

すべての注目すべき変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づき、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

### Added

- 拡張機能: popup に「メンバートークン (任意)」フィールドを追加。Gateway モード時に
  `X-Member-Token` ヘッダーとして送出される
- `cloudflare-worker/` ディレクトリに認証あり/なし両対応の Worker テンプレを同梱
  - `ALLOWED_TOKENS` 環境変数の有無で自動切替
  - `/admin` (管理 UI) は将来的な拡張用として README に手順記載
  - `wrangler tail` でリアルタイムアクセスログ確認

## [0.1.0] - 2026-05-28

### Added

- Slack の Web 版メッセージ入力欄に AI リライトストリップを inline 挿入
- メイン入力欄 / スレッド / DM すべての入力欄に対応
- 7 種類のプリセットプロンプト（丁寧/整理/構造化/簡潔/カジュアル/箇条書き/英訳）
- ワンショット指示（自由入力 → Enter で即リライト）
- 重ねがけ対応（連続して別の指示を当てられる）
- ↩ undo / ⟲ 原型復帰
- プロンプトの追加・編集・並び替え・削除
- Gemini API 直接モード / Cloudflare Worker Gateway モード
- Slack mrkdwn 形式に準拠した出力（`*太字*`, `_斜体_`, `• 箇条書き` 等）
- メンション・URL・絵文字ショートコード保持
- キーボードショートカット (`Alt+Shift+A` / `R` / `1` 〜 `9`)

[Unreleased]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nyanko3141592/SlackInputExtension/releases/tag/v0.1.0

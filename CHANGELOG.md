# Changelog

すべての注目すべき変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づき、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

## [0.3.1] - 2026-05-29

### Added

- **録音中の音量フィードバック**: マイクボタンが入力ボリュームに応じて
  脈動 (box-shadow が広がり、背景濃度が増す)
- AudioContext + AnalyserNode で RMS を計算、ローパスフィルタで滑らかに
- 録音停止・文字起こし完了で自動的にアイドル状態へ復帰

## [0.3.0] - 2026-05-29

### Changed

- **音声入力の挙動を変更**: 🎤 ボタンは「リライト指示」ではなく
  「**Slack 入力欄に本文として音声挿入**」に再定義
  - 音声 → Gemini で文字起こし → Slack 入力欄の末尾に追記 (リライトはしない)
  - 既存テキストがあれば改行で区切る
  - CoeInput と機能的に被るが、Slack 専用の音声入力として独立
- **指示入力を複数行対応**: ``<input>`` → ``<textarea>`` に変更
  - `Enter` で即リライト実行
  - `Shift+Enter` で改行
  - 内容に応じて高さ自動調整 (最大 140px)

### Internal

- ``background.js``: ``transcribeInstruction`` → ``transcribeForInput`` に名前変更
- 本文向けプロンプトに変更 (フィラー除去 + 自然な文章整形)
- ``appendToEditor`` ヘルパー追加 (Slack 入力欄末尾追記)

## [0.2.0] - 2026-05-29

### Added

- **音声入力** (案 A): ストリップに 🎤 マイクボタンを追加
  - クリックで録音開始、再クリックで停止
  - 音声を Gemini に送信して「短い AI 指示文」として文字起こし
  - 結果を入力欄にセットして自動 Enter → 即リライト実行
  - フィラー除去・指示の標準化を Gemini 側で行う
- 拡張機能: popup に「メンバートークン (任意)」フィールドを追加。Gateway モード時に
  `X-Member-Token` ヘッダーとして送出される
- `cloudflare-worker/` ディレクトリに認証あり/なし両対応の Worker テンプレを同梱
  - `ALLOWED_TOKENS` 環境変数の有無で自動切替
  - `wrangler tail` でリアルタイムアクセスログ確認
- `cloudflare-worker/scripts/` にメンバートークン管理スクリプト (issue / revoke / list)

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

[Unreleased]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nyanko3141592/SlackInputExtension/releases/tag/v0.1.0

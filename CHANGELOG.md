# Changelog

すべての注目すべき変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づき、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

## [0.5.0] - 2026-05-29

### Added

- **辞書機能**: popup に「辞書」タブを追加。
  - 誤変換しやすい語 (`from`) と正しい表記 (`to`)、メモ (任意) を登録
  - リライト・音声文字起こしの両方で自動置換
  - LLM プロンプトに辞書ヒントを注入 + 後処理でも機械置換 (二重ガード)
  - **CSV 取り込み / 書き出し** に対応 (UTF-8 BOM 付き、Excel 互換)
  - フォーマット: `from,to,note` ヘッダー必須
  - 既存と同じ `from` を取り込んだ場合は上書き

### Changed

- **デフォルトモデルを `gemini-2.5-flash-lite` に変更**: より高速。リライト用途では十分な品質。
  - 既存ユーザーで未保存の人にも適用
  - LEGACY_MODEL_MAP も flash-lite 寄せに更新 (`gemini-2.0-flash` → `flash-lite`)
- popup datalist の並び順を変更: `flash-lite` を先頭に

## [0.4.0] - 2026-05-29

### Changed

- **モデル選択を自由入力に変更**: 固定 `<select>` から `<input>` + `<datalist>` に。
  推奨候補から選ぶことも、任意のモデル名を直接入力することも可能に。
  - 新しい Gemini モデル (3 系 preview など) が出たときに popup から即試せる
  - 既存ユーザーは未保存なら gemini-2.5-flash がそのままデフォルト
  - 命名規則 (`gemini-...`) と異なる場合は保存時に確認ダイアログ

### Added

- プリセット候補に `gemini-3-pro-preview` / `gemini-3-flash-preview` を追加
- 公式モデル一覧ページへのリンクを popup に追加

## [0.3.2] - 2026-05-29

### Added

- **音声入力に最大録音時間 5 分の制限**: 長時間誤録音による API コスト爆発・
  リクエストサイズ上限超過を防止
  - 残り 30 秒で input placeholder に警告表示
  - 5 分到達で自動停止 + 録音内容はそのまま文字起こしへ進む

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

[Unreleased]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nyanko3141592/SlackInputExtension/releases/tag/v0.1.0

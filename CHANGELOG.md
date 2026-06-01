# Changelog

すべての注目すべき変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づき、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

## [0.6.2] - 2026-06-01

### Changed

- **辞書編集の挙動を「明示保存」に変更**: 既存エントリを編集しても
  サイレントに自動保存されず、行を黄色く強調 + 行末に
  💾 / ↺ ボタンを表示。明示的にクリックした時のみ反映する。
  - 保存後は行が緑にフラッシュして反映を視覚化
  - 取消ボタンで編集前に戻せる
- 新規追加時の Enter キーでの自動確定を廃止。誤入力で追加されてしまう
  問題に対応。**＋ 追加 ボタンのクリック** で明示確定する形に統一
  - パワーユーザー向けに Ctrl/Cmd+Enter のショートカットだけ残す
- 追加フォーム枠をブランドカラーで強調し、placeholder にも
  「読み / 表示」を併記して何を入れるべきか明確化
- 削除ボタンを押した時の確認ダイアログに対象エントリ名を含めるよう改善

### Internal

- CI workflow に concurrency group / frozen-lockfile を追加して
  in-flight build の重複と lockfile drift を抑止
- Release workflow に tag と manifest.json の version 一致チェックを追加

## [0.6.1] - 2026-06-01

### Added

- **文字起こしプロンプトを popup で編集可能に**
  - 「プロンプト」タブの最上部に「🎤 文字起こしプロンプト」セクションを追加
  - 自由に編集 / 「↺ デフォルトに戻す」ボタンで初期化
  - 空のまま保存するとデフォルトを使用 (chrome.storage の transcribePrompt を削除)
  - storage キー: `transcribePrompt` (sync)

### Changed

- **デフォルト文字起こしプロンプトに「フィラー削除」を再追加**
  - 「えーと / あの / まあ / ん〜 / えー / そのー」など意味のないつなぎ語は削除
  - ただし、言い直し・繰り返し・本文内容は引き続き残す (= 補正しない)
  - 「補正しない」と「フィラー削除」を両立する形に

## [0.6.0] - 2026-06-01

### Changed

- **音声文字起こしのプロンプトを「補正なし」方針に変更**
  - フィラー (「えーと」「あの」など) を削除しない
  - 言い直し・言いよどみ・繰り返しもそのまま残す
  - 内容の要約・補完・整形・別単語への言い換えを禁止
  - 出力は「聞こえた音をそのまま忠実に書き起こす」のみ
  - リライトしたい場合は ✨ AI 側で明示的に指示する流れに統一

### Added

- **文字起こし用モデルをリライト用と別に設定可能に**
  - popup の「API 設定」タブに「モデル (音声文字起こし)」フィールドを追加
  - 未指定なら従来通り (リライト用が lite なら自動で flash に昇格)
  - 明示指定すればその値を使用 (例: 文字起こしは pro、リライトは lite)
  - LEGACY_MODEL_MAP も transcribeModel に適用

## [0.5.3] - 2026-06-01

### Fixed

- **音声入力の文字起こし精度を改善**: `gemini-2.5-flash-lite` (デフォルト) は
  音声理解の精度が低く、まったく違う文章が起こされるケースがあったため、
  **音声起こし時のみ自動で `gemini-2.5-flash` 以上にアップグレード**する。
  - ユーザー設定は触らないので、テキストリライトは引き続き lite で速い
  - lite 以外のモデルを指定している場合はそのまま使う
- 文字起こしプロンプトを精度優先に書き換え (`temperature` を 0.4 → 0.2)
  - 「聞こえた音をそのまま忠実に書き起こす」を最優先指示に
  - 解釈で別単語に置き換えないよう明示

## [0.5.2] - 2026-05-29

### Fixed

- **辞書を `chrome.storage.local` に変更**: 大規模辞書 (100 件規模) を
  取り込もうとすると `Resource::kQuotaBytesPerItem quota exceeded` で
  保存できない問題を修正。
  - `chrome.storage.sync` は単一アイテム 8KB の制限があり、社内辞書のような
    数 KB を超える単一値は保存不可
  - 辞書は **同期不要 (各メンバー個別に管理する想定)** なので local へ移行
  - local は単一アイテム制限なし / 全体 5MB
- 旧バージョンの sync.dictionary を起動時に自動で local へ移行 + sync 側を削除
- 取り込み失敗時のエラーメッセージを具体的に

## [0.5.1] - 2026-05-29

### Changed

- **辞書の列名を「読み (reading) / 表示 (display)」に変更** (旧: 誤 / 正)
  - 用途実態は「LLM が誤変換しやすい読み方を、正式な表記にマッピング」なので、より直感的なラベルに
  - LLM 用プロンプトの説明文も「読み → 表示」に追従
- CSV ヘッダーも `reading,display,note` に変更
  - 旧版 (`from,to,note`) の取り込みも互換で受け付ける (header alias)
- popup の placeholder 例を一般的な技術用語 (`あいおーえす` → `iOS`) に差し替え

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

[Unreleased]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.6.2...HEAD
[0.6.2]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.5.3...v0.6.0
[0.5.3]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nyanko3141592/SlackInputExtension/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nyanko3141592/SlackInputExtension/releases/tag/v0.1.0

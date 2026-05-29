#!/usr/bin/env node

// 個別メンバーのトークンを発行し、members.json に追記して
// ALLOWED_TOKENS を Worker に自動で push する。
//
// Usage:
//   node scripts/issue-token.js <member-name> [--note "備考"] [--gateway-url <url>] [--no-deploy]
//
// 例:
//   node scripts/issue-token.js tanaka
//   node scripts/issue-token.js suzuki --note "engineering" --gateway-url https://yourorg-ai-gateway.YOUR-SUBDOMAIN.workers.dev
//   node scripts/issue-token.js misaki --no-deploy   # secret push せずに発行だけ
//
// このスクリプトは cloudflare-worker/ ディレクトリで実行する想定。

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MEMBERS_PATH = path.join(ROOT, 'members.json');
const WRANGLER_PATH = path.join(ROOT, 'wrangler.toml');

const args = process.argv.slice(2);
const member = args.find((a) => !a.startsWith('--'));
const note = takeArg('--note') || '';
const gatewayUrl = takeArg('--gateway-url') || readGatewayUrlFromWrangler();
const skipDeploy = args.includes('--no-deploy');

if (!member) {
  console.error(
    'Usage: node scripts/issue-token.js <member-name> [--note "..."] [--gateway-url <url>] [--no-deploy]'
  );
  process.exit(1);
}

const members = loadMembers();
if (members.find((m) => m.id === member)) {
  console.error(`Error: Member "${member}" already exists in members.json`);
  console.error(
    '既存トークンを再利用してください。新しいトークンが必要なら一度 revoke してから issue してください。'
  );
  process.exit(1);
}

const token = crypto.randomUUID();
members.push({
  id: member,
  token,
  issued: new Date().toISOString().slice(0, 10),
  note,
});
saveMembers(members);

if (!skipDeploy) {
  const tokens = members.map((m) => m.token).join(',');
  console.log(`\n📡 Pushing ALLOWED_TOKENS to Worker (${members.length} members)...`);
  try {
    execSync(`echo "${tokens}" | wrangler secret put ALLOWED_TOKENS`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch {
    console.error('\n⚠️  wrangler secret put が失敗しました。手動で再実行してください:');
    console.error(`    cd cloudflare-worker && echo "${tokens}" | wrangler secret put ALLOWED_TOKENS`);
    process.exit(1);
  }
}

// 配布用テンプレ出力
const setupUrl = gatewayUrl || 'https://<YOUR-WORKER>.workers.dev';
console.log('');
console.log('✅ 発行完了');
console.log('---');
console.log(`Member  : ${member}`);
console.log(`Token   : ${token}`);
if (note) console.log(`Note    : ${note}`);
console.log(`Gateway : ${setupUrl}`);
console.log('---');
console.log('');
console.log('📋 Slack DM 用テンプレ (コピペ可):');
console.log('');
console.log(
  '```\n' +
    `@${member} さん、Slack AI Rewriter のセットアップ情報を送ります。\n` +
    '\n' +
    '1. Chrome Web Store から「Slack AI Rewriter」をインストール\n' +
    '   (まだ未公開の場合は下記の dev 用 zip を案内)\n' +
    '2. 拡張機能アイコンをクリック → 「API 設定」タブ\n' +
    '3. 接続モード: 「Gateway (Cloudflare Worker)」\n' +
    `4. Gateway URL: ${setupUrl}\n` +
    `5. メンバートークン: ${token}\n` +
    '6. 「保存」\n' +
    '\n' +
    'Slack 入力欄の送信ボタン横にストリップが出れば成功です。\n' +
    'トラブルあれば連絡してください。\n' +
    '```'
);

// ========== Helpers ==========

function takeArg(name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  return args[i + 1] || null;
}

function loadMembers() {
  if (!fs.existsSync(MEMBERS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(MEMBERS_PATH, 'utf8'));
  } catch (err) {
    console.error(`Error parsing ${MEMBERS_PATH}:`, err.message);
    process.exit(1);
  }
}

function saveMembers(list) {
  fs.writeFileSync(MEMBERS_PATH, JSON.stringify(list, null, 2) + '\n');
  console.log(`✓ Updated ${path.relative(process.cwd(), MEMBERS_PATH)} (${list.length} members)`);
}

function readGatewayUrlFromWrangler() {
  if (!fs.existsSync(WRANGLER_PATH)) return null;
  const txt = fs.readFileSync(WRANGLER_PATH, 'utf8');
  const m = txt.match(/^name\s*=\s*["']([^"']+)["']/m);
  if (!m) return null;
  // ユーザーのサブドメインは知らないので推測URLを返す（手動で書き換え推奨）
  return `https://${m[1]}.YOUR-SUBDOMAIN.workers.dev`;
}

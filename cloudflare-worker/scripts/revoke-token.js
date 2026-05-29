#!/usr/bin/env node

// 指定メンバーのトークンを取り消す。
// members.json から削除して、残りで ALLOWED_TOKENS を再生成 → Worker に push。
//
// Usage:
//   node scripts/revoke-token.js <member-name> [--no-deploy]

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MEMBERS_PATH = path.join(ROOT, 'members.json');

const args = process.argv.slice(2);
const member = args.find((a) => !a.startsWith('--'));
const skipDeploy = args.includes('--no-deploy');

if (!member) {
  console.error('Usage: node scripts/revoke-token.js <member-name> [--no-deploy]');
  process.exit(1);
}

if (!fs.existsSync(MEMBERS_PATH)) {
  console.error(`members.json が存在しません: ${MEMBERS_PATH}`);
  process.exit(1);
}

const members = JSON.parse(fs.readFileSync(MEMBERS_PATH, 'utf8'));
const target = members.find((m) => m.id === member);
if (!target) {
  console.error(`Error: Member "${member}" not found in members.json`);
  console.error('現在のメンバー:');
  members.forEach((m) => console.error(`  - ${m.id}`));
  process.exit(1);
}

const remaining = members.filter((m) => m.id !== member);
fs.writeFileSync(MEMBERS_PATH, JSON.stringify(remaining, null, 2) + '\n');

console.log(`✓ Removed ${member} from members.json`);
console.log(`✓ Revoked token: ${target.token.slice(0, 8)}...`);

if (!skipDeploy) {
  console.log(`\n📡 Pushing updated ALLOWED_TOKENS to Worker (${remaining.length} members remaining)...`);
  try {
    if (remaining.length === 0) {
      // 全員消したら ALLOWED_TOKENS を削除 (Open Gateway モードに戻る)
      console.log(
        '⚠️  メンバーが 0 人になったので ALLOWED_TOKENS を削除します。Worker は Open Gateway モードに切り替わります。'
      );
      execSync('wrangler secret delete ALLOWED_TOKENS --force', { cwd: ROOT, stdio: 'inherit' });
    } else {
      const tokens = remaining.map((m) => m.token).join(',');
      execSync(`echo "${tokens}" | wrangler secret put ALLOWED_TOKENS`, {
        cwd: ROOT,
        stdio: 'inherit',
      });
    }
  } catch {
    console.error('\n⚠️  wrangler 操作が失敗しました。手動で再実行してください。');
    process.exit(1);
  }
}

console.log('\n✅ 完了。即座に対象トークンは無効化されました。');

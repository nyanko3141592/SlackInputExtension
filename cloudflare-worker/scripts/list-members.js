#!/usr/bin/env node

// 現在のメンバー一覧を表示。トークンは先頭 8 文字のみマスク表示。
//
// Usage:
//   node scripts/list-members.js
//   node scripts/list-members.js --full   # トークン全体を表示 (取扱注意)

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MEMBERS_PATH = path.join(ROOT, 'members.json');

const full = process.argv.includes('--full');

if (!fs.existsSync(MEMBERS_PATH)) {
  console.log('members.json が存在しません。まだメンバーが発行されていません。');
  console.log('  node scripts/issue-token.js <member-name>  で発行してください。');
  process.exit(0);
}

const members = JSON.parse(fs.readFileSync(MEMBERS_PATH, 'utf8'));
if (members.length === 0) {
  console.log('(メンバー登録なし)');
  process.exit(0);
}

const widths = {
  id: Math.max(8, ...members.map((m) => m.id.length)),
  issued: 10,
  note: Math.max(4, ...members.map((m) => (m.note || '').length)),
};

console.log('');
console.log(
  pad('Member', widths.id) +
    '  ' +
    pad('Issued', widths.issued) +
    '  ' +
    pad('Token', full ? 36 : 12) +
    '  ' +
    'Note'
);
console.log('─'.repeat(widths.id + widths.issued + (full ? 36 : 12) + widths.note + 6));
for (const m of members) {
  console.log(
    pad(m.id, widths.id) +
      '  ' +
      pad(m.issued || '-', widths.issued) +
      '  ' +
      pad(full ? m.token : m.token.slice(0, 8) + '...', full ? 36 : 12) +
      '  ' +
      (m.note || '')
  );
}
console.log('');
console.log(`Total: ${members.length} members`);
if (!full) {
  console.log('(--full でトークン全体を表示)');
}

function pad(s, w) {
  return String(s).padEnd(w);
}

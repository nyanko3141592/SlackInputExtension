#!/usr/bin/env node
// Chrome Web Store 配信用 zip を生成する。
// 同梱ファイル: manifest, スクリプト, popup, content, アイコン, README, LICENSE, PRIVACY

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const INCLUDE = [
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'popup.html',
  'popup.css',
  'popup.js',
  'icons',
  'README.md',
  'LICENSE',
  'PRIVACY.md',
];

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const zipName = `slack-ai-rewriter-v${manifest.version}.zip`;
const zipPath = path.join(DIST, zipName);

fs.mkdirSync(DIST, { recursive: true });
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

for (const entry of INCLUDE) {
  if (!fs.existsSync(path.join(ROOT, entry))) {
    console.error(`[build-zip] missing: ${entry}`);
    process.exit(1);
  }
}

execFileSync('zip', ['-r', '-X', zipPath, ...INCLUDE], { cwd: ROOT, stdio: 'inherit' });

const stat = fs.statSync(zipPath);
console.log(`\n✓ created ${path.relative(ROOT, zipPath)} (${(stat.size / 1024).toFixed(1)} KB)`);

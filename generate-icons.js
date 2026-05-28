const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function generateSvg(size) {
  const r = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const sw = Math.max(size * 0.07, 1.5);
  // Pencil/edit icon
  const len = size * 0.5;
  const x1 = cx - len / 2;
  const y1 = cy + len / 2;
  const x2 = cx + len / 2;
  const y2 = cy - len / 2;
  // Sparkle (AI accent) — small star top-right
  const sx = size * 0.74;
  const sy = size * 0.26;
  const ssz = size * 0.12;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#4A154B"/>
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="white" stroke-width="${sw}" stroke-linecap="round"/>
  <line x1="${x1 + sw * 0.6}" y1="${y1 - sw * 0.6}" x2="${x1 - sw * 0.2}" y2="${y1 + sw * 0.2}" stroke="white" stroke-width="${sw * 0.8}" stroke-linecap="round"/>
  <g fill="#ECB22E">
    <polygon points="${sx},${sy - ssz} ${sx + ssz * 0.3},${sy - ssz * 0.3} ${sx + ssz},${sy} ${sx + ssz * 0.3},${sy + ssz * 0.3} ${sx},${sy + ssz} ${sx - ssz * 0.3},${sy + ssz * 0.3} ${sx - ssz},${sy} ${sx - ssz * 0.3},${sy - ssz * 0.3}"/>
  </g>
</svg>`;
}

async function main() {
  for (const size of sizes) {
    const svg = generateSvg(size);
    const filePath = path.join(iconsDir, `icon${size}.png`);
    await sharp(Buffer.from(svg)).png().toFile(filePath);
    console.log(`Generated: ${filePath}`);
  }
  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');
const inPath = path.join(__dirname, '..', 'src', 'assets', 'pollon.png');
const outDir = path.join(__dirname, '..', 'src-tauri', 'icons');
const outPath = path.join(outDir, 'icon.ico');
if (!fs.existsSync(inPath)) {
  console.error('Input PNG not found:', inPath);
  process.exit(1);
}
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const png = fs.readFileSync(inPath);
// ICO header: 6 bytes; entry: 16 bytes
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type = icon
header.writeUInt16LE(1, 4); // count = 1
const entry = Buffer.alloc(16);
// width and height (1 byte each): 0 means 256
entry.writeUInt8(0, 0); // width
entry.writeUInt8(0, 1); // height
entry.writeUInt8(0, 2); // color count
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bit count
entry.writeUInt32LE(png.length, 8); // bytes in resource
const imageOffset = 6 + 16; // header + entry
entry.writeUInt32LE(imageOffset, 12); // image offset
const out = Buffer.concat([header, entry, png]);
fs.writeFileSync(outPath, out);
console.log('Wrote ICO to', outPath);

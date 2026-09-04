/* Rasterize public/favicon.svg into the icon files Google + browsers actually
   fetch: favicon.ico (root-probed by everything), favicon-96.png (Google
   Search prefers a PNG at a multiple of 48), apple-touch-icon.png (iOS).
   Run after editing favicon.svg:  node scripts/gen-favicons.mjs
   Not part of the build — the outputs are committed. */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url));
const out = (name) => new URL('../public/' + name, import.meta.url);

const png = (size) =>
  sharp(svg, { density: 384 }).resize(size, size, { fit: 'contain' }).png().toBuffer();

// Wrap a single 32x32 PNG in a minimal ICO container. PNG-in-ICO is valid and
// universally supported (Vista+); sharp can't emit .ico directly.
function pngToIco(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);   // reserved
  header.writeUInt16LE(1, 2);   // type: 1 = icon
  header.writeUInt16LE(1, 4);   // image count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);      // width
  entry.writeUInt8(32, 1);      // height
  entry.writeUInt8(0, 2);       // palette count
  entry.writeUInt8(0, 3);       // reserved
  entry.writeUInt16LE(1, 4);    // color planes
  entry.writeUInt16LE(32, 6);   // bits per pixel
  entry.writeUInt32LE(pngBuf.length, 8);  // image data size
  entry.writeUInt32LE(6 + 16, 12);        // offset to image data
  return Buffer.concat([header, entry, pngBuf]);
}

const png32 = await png(32);
await writeFile(out('favicon.ico'), pngToIco(png32));
await writeFile(out('favicon-96.png'), await png(96));
// apple-touch-icon: iOS ignores transparency and adds its own rounding, so a
// flat opaque square is correct — favicon.svg already has an opaque dark tile.
await writeFile(out('apple-touch-icon.png'), await png(180));

console.log('wrote favicon.ico, favicon-96.png, apple-touch-icon.png from favicon.svg');

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Resized WebP variants written by scripts/image-variants.mjs at prebuild
 * (`/images/x-hero.webp` -> `/images/x-hero.w800.webp`). Returns the variant
 * URL only if that file actually exists in public/, otherwise the original,
 * so a missing variant can never produce a broken image.
 */
export function variant(src: string | null | undefined, width: number): string | null {
  if (!src) return null;
  if (!/^\/images\/[^?#]+\.webp$/.test(src)) return src;
  const v = src.replace(/\.webp$/, `.w${width}.webp`);
  return existsSync(path.join(process.cwd(), 'public', v)) ? v : src;
}

/** `srcset` pairing a variant with its original, or undefined if there's no variant. */
export function srcsetWith(src: string | null | undefined, width: number, originalWidth: number): string | undefined {
  const v = variant(src, width);
  if (!src || !v || v === src) return undefined;
  return `${v} ${width}w, ${src} ${originalWidth}w`;
}

/**
 * Intrinsic pixel size read straight from a WebP header under public/, so an
 * <img> can carry real width/height (CLS reservation) without hardcoding
 * dimensions per page. Null for a missing file or any other format.
 */
export function webpDims(publicPath: string): { width: number; height: number } | null {
  const fsPath = path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
  if (!/\.webp$/i.test(fsPath) || !existsSync(fsPath)) return null;
  const buf = readFileSync(fsPath);
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (fourcc === 'VP8X') {
    return {
      width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
      height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
    };
  }
  if (fourcc === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  return null;
}

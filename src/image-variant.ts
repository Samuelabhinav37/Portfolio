import { existsSync } from 'node:fs';
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

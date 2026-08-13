#!/usr/bin/env node
/* Post-build hardening pass: minify the first-party inline <script> blocks
   that ship in the built HTML output (dist/), and strip literal HTML
   <!-- --> comments from the markup so dev notes aren't visible via
   view-source.

   Why this exists: most pages in this project were ported from flat HTML and
   still rely on many <script> tags sharing one global scope (see is:inline
   usage across src/pages/*.astro), so Astro/Vite never bundles or minifies
   them — they'd otherwise ship byte-for-byte as authored, fully readable in
   view-source. External <script src> tags, the Three.js `type="module"`
   block (import/export — left untouched to avoid parser edge cases), the
   importmap, and JSON-LD blocks are all skipped.

   This is terser-only (mangle + strip comments/whitespace), not full
   identifier/control-flow obfuscation. A javascript-obfuscator pass was
   tried and dropped: on this codebase's largest script (Luna's ~60KB
   embedded HTML/JS string, injected into a blob iframe) it produced
   syntactically invalid output on some runs and valid output on others from
   the *same* input and options — non-deterministic corruption in its string
   encoder. That's disqualifying for a build step; a broken site is worse
   than a readable one. Every minified block is re-parsed with acorn before
   being written back — if that check ever fails, the original source for
   that block is kept untouched rather than shipping something broken. */

import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as terser from 'terser';
import * as acorn from 'acorn';

const DIST = new URL('../dist/', import.meta.url);
// glob()'s cwd option: Node 24 (this machine) accepts a URL there directly,
// but Cloudflare Pages' build image (Node 22.16) throws "paths[0] argument
// must be of type string. Received an instance of URL" — glob's internal
// path resolution isn't URL-aware on that version. A plain string works on
// both, so resolve it once here rather than passing DIST itself.
const DIST_PATH = fileURLToPath(DIST);

// Attrs segment matches quoted attribute values as atomic units so a '>'
// inside e.g. data-x=">" can't be mistaken for the tag's real closing '>'.
const SCRIPT_TAG_RE = /<script((?:\s+(?:"[^"]*"|'[^']*'|[^"'>])*)?)>([\s\S]*?)<\/script>/gi;
// about.astro embeds a whole mini-game as an HTML-entity-escaped srcdoc="..."
// attribute (its own <script> tags appear as literal text once escaped, but
// the raw string can still confuse a naive regex scan). Mask those spans out
// before hunting for real <script> tags, then restore them untouched.
const SRCDOC_RE = /srcdoc="[\s\S]*?"/g;

function shouldSkip(attrs) {
  if (/\bsrc\s*=/.test(attrs)) return true; // external script
  if (/type\s*=\s*["']?(importmap|application\/(ld\+)?json)["']?/i.test(attrs)) return true;
  if (/type\s*=\s*["']?module["']?/i.test(attrs)) return true; // import/export — left untouched
  return false;
}

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
// A single .replace pass can leave a new "<!--...-->" behind where removing
// one nested/malformed comment splices two surviving fragments back
// together — reapply until a pass makes no further change.
function stripCommentsFully(str) {
  let prev;
  do { prev = str; str = str.replace(HTML_COMMENT_RE, ''); } while (str !== prev);
  return str;
}

function parsesCleanly(code) {
  try {
    acorn.parse(code, { ecmaVersion: 2022 });
    return true;
  } catch {
    return false;
  }
}

// Strip literal HTML <!-- --> comments from the markup so dev notes aren't
// sitting in view-source. Never touches inside <script> tags or the
// srcdoc="..." attribute — both are protected behind unique placeholder
// tokens first, since blindly regexing "<!--...-->" across the whole file
// could otherwise slice into a JS string that happens to contain that
// literal text (Luna's embedded HTML has its own <!-- comment --> as plain
// text inside a template literal).
function stripHtmlComments(html) {
  const chunks = [];
  function protect(str) {
    const token = `@@HTMLCOMMENT_PROTECT_${chunks.length}@@`;
    chunks.push(str);
    return token;
  }
  // The srcdoc value is itself a whole embedded document with its own
  // (mostly entity-escaped, sometimes literal) <script> tags and its own
  // literal <!-- --> comments. Clean those before protecting the blob
  // wholesale, so decorative section markers don't survive inside it too.
  let masked = html.replace(SRCDOC_RE, (m) => {
    const inner = stripCommentsFully(m.replace(SCRIPT_TAG_RE, protect));
    return protect(inner);
  });
  masked = masked.replace(SCRIPT_TAG_RE, protect);
  masked = stripCommentsFully(masked);
  for (let i = chunks.length - 1; i >= 0; i--) {
    masked = masked.replace(`@@HTMLCOMMENT_PROTECT_${i}@@`, () => chunks[i]);
  }
  return masked;
}

async function processFile(path) {
  const html = await readFile(path, 'utf8');
  let changed = false;
  let totalBefore = 0, totalAfter = 0, kept = 0;

  // Search on a masked copy (srcdoc="..." spans blanked out, same length)
  // so we never mistake escaped/embedded markup for a real <script> tag —
  // but every match's index/length is still valid against the real `html`.
  const masked = html.replace(SRCDOC_RE, (m) => 'x'.repeat(m.length));
  const matches = [...masked.matchAll(SCRIPT_TAG_RE)];
  let out = html;
  // Replace back-to-front so earlier match indices stay valid.
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const attrs = m[1] || '';
    const code = m[2];
    if (shouldSkip(attrs) || !code.trim()) continue;

    let finalCode = code;
    try {
      const minified = await terser.minify(code, {
        module: false,
        compress: true,
        mangle: true,
        format: { comments: false },
      });
      if (minified.code && parsesCleanly(minified.code)) {
        finalCode = minified.code;
      } else {
        kept++;
        console.warn(`  ! kept original (minified output failed verification) in ${path.pathname.split('/dist/')[1] || path}`);
      }
    } catch (err) {
      kept++;
      console.warn(`  ! kept original (terser error: ${err.message}) in ${path.pathname.split('/dist/')[1] || path}`);
    }

    if (finalCode !== code) {
      totalBefore += code.length;
      totalAfter += finalCode.length;
      const start = m.index;
      const end = m.index + m[0].length;
      const newTag = `<script${attrs}>${finalCode}</script>`;
      out = out.slice(0, start) + newTag + out.slice(end);
      changed = true;
    }
  }

  const withoutComments = stripHtmlComments(out);
  if (withoutComments !== out) {
    out = withoutComments;
    changed = true;
  }

  if (changed) {
    await writeFile(path, out, 'utf8');
  }
  return { changed, totalBefore, totalAfter, kept };
}

// dist/scripts/*.js are public/ passthrough files — Astro/Vite never bundles
// or minifies them, so they otherwise ship at full source size with comments
// intact (confirmed: nebula-engine.js + nebula-engine-home.js alone total
// ~254KB unminified). Same terser config + acorn re-parse safety net as the
// inline-script pass above: on any failure, the original file is left as-is.
async function processJsFile(path) {
  const code = await readFile(path, 'utf8');
  if (!code.trim()) return { changed: false, before: 0, after: 0, kept: 0 };
  try {
    const minified = await terser.minify(code, {
      module: false,
      compress: true,
      mangle: true,
      format: { comments: false },
    });
    if (minified.code && parsesCleanly(minified.code) && minified.code.length < code.length) {
      await writeFile(path, minified.code, 'utf8');
      return { changed: true, before: code.length, after: minified.code.length, kept: 0 };
    }
    if (minified.code && parsesCleanly(minified.code)) {
      return { changed: false, before: code.length, after: code.length, kept: 0 }; // already smaller/equal
    }
    console.warn(`  ! kept original (minified output failed verification) in ${path.pathname.split('/dist/')[1] || path}`);
    return { changed: false, before: code.length, after: code.length, kept: 1 };
  } catch (err) {
    console.warn(`  ! kept original (terser error: ${err.message}) in ${path.pathname.split('/dist/')[1] || path}`);
    return { changed: false, before: code.length, after: code.length, kept: 1 };
  }
}

async function main() {
  let files = 0, blocksBefore = 0, blocksAfter = 0, keptTotal = 0;
  for await (const entry of glob('**/*.html', { cwd: DIST_PATH })) {
    const path = new URL(entry, DIST);
    const { changed, totalBefore, totalAfter, kept } = await processFile(path);
    keptTotal += kept;
    if (changed) {
      files++;
      blocksBefore += totalBefore;
      blocksAfter += totalAfter;
      console.log(`minified: ${entry}  (${totalBefore} -> ${totalAfter} bytes)`);
    }
  }
  console.log(`\nDone. ${files} file(s) touched, ${blocksBefore} -> ${blocksAfter} bytes of inline script. ${keptTotal} block(s) kept as original source.`);

  let jsFiles = 0, jsBefore = 0, jsAfter = 0, jsKept = 0;
  for await (const entry of glob('scripts/**/*.js', { cwd: DIST_PATH })) {
    const path = new URL(entry, DIST);
    const { changed, before, after, kept } = await processJsFile(path);
    jsKept += kept;
    if (changed) {
      jsFiles++;
      jsBefore += before;
      jsAfter += after;
      console.log(`minified: ${entry}  (${before} -> ${after} bytes)`);
    }
  }
  console.log(`Done. ${jsFiles} public/scripts file(s) minified, ${jsBefore} -> ${jsAfter} bytes. ${jsKept} file(s) kept as original source.`);
}

main().catch((err) => {
  console.error('obfuscate.mjs failed:', err);
  process.exit(1);
});

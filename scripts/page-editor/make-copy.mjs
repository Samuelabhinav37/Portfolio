/* Builds an editable copy of a built page for the page editor.
 *
 *   bun run build
 *   node scripts/page-editor/make-copy.mjs [page] [outDir]
 *
 * page defaults to index.html (the homepage), outDir to .page-editor/.
 * It copies the page and every file it pulls in (scripts, styles, fonts,
 * images, recursively), rewrites the site-absolute paths ("/scripts/x.js")
 * to relative ones so the copy works from any folder or host, turns off
 * analytics, and adds editor.js. The output folder can be opened with any
 * static server or published as one Artifact.
 */
import { mkdir, readFile, readdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, '../../dist');
const page = process.argv[2] || 'index.html';
const OUT = process.argv[3] || join(here, '../../.page-editor');

const TEXT = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg']);
// Site-absolute references to files in dist. Page links (/blog/ etc.) are
// left alone: the copy is one page.
const REF = /(["'`(\s,])\/((?:_astro|scripts|images|fonts|videos)\/[^"'`)\s,?#]+)/g;

const seen = new Set();
const files = [];

async function visit(rel) {
  if (seen.has(rel)) return;
  seen.add(rel);
  // A folder reference ('/images/kai/' + name) pulls in the whole folder.
  if (rel.endsWith('/')) {
    try { for (const f of await readdir(join(DIST, rel))) await visit(rel + f); } catch { console.warn('missing:', rel); }
    return;
  }
  let buf;
  try { buf = await readFile(join(DIST, rel)); } catch { console.warn('missing:', rel); return; }
  files.push(rel);
  if (!TEXT.has(extname(rel))) return;
  const text = buf.toString('utf8');
  for (const m of text.matchAll(REF)) await visit(m[2]);
}

await visit(page);
await rm(OUT, { recursive: true, force: true });

// Claude's artifact host reserves top-level names starting with "_".
const outPath = (rel) => rel.replace(/^_astro\//, 'astro/');

for (const rel of files) {
  const to = join(OUT, outPath(rel));
  await mkdir(dirname(to), { recursive: true });
  if (!TEXT.has(extname(rel))) { await copyFile(join(DIST, rel), to); continue; }
  // Relative to the page's folder: the copy's page sits at the root.
  let text = (await readFile(join(DIST, rel), 'utf8')).replace(REF, (_, pre, path) => {
    // CSS url()s and a worker's importScripts resolve against their own
    // file, everything else against the page.
    if (rel.endsWith('.css') || rel.endsWith('-worker.js')) {
      const depth = rel.split('/').length - 1;
      return pre + '../'.repeat(depth) + outPath(path);
    }
    return pre + outPath(path);
  });
  if (rel === page) {
    // An element with Clarity's id makes its loader skip, so editing
    // sessions don't land in the site's analytics.
    text = text.replace('<head>', '<head><meta id="clarity-script"><script>window.clarity=function(){};</script>')
      .replace(/<title>[^<]*<\/title>/, '<title>Homepage Editor</title>')
      .replace('</body>', '<script src="page-editor.js"></script></body>');
  }
  await writeFile(to, text);
}
await copyFile(join(here, 'editor.js'), join(OUT, 'page-editor.js'));

console.log(`page editor: ${files.length} files → ${OUT}`);
console.log(files.filter((f) => f !== page).join('\n'));

/* Post-build CSP lint. Fails the build on inline code the production CSP
   (functions/_middleware.js) will silently block.

   script-src carries a per-build hash list, and once any hash is present
   browsers ignore 'unsafe-inline'. Two patterns can never be covered by
   those hashes, so they break in production with nothing visible beyond a
   console line:

   1. Inline event-handler attributes (onload="", onclick="", ...), whether
      written in markup or built in a JS template string. Hashing handlers
      would need 'unsafe-hashes', which this site doesn't use.
   2. Inline <script> bodies inside an iframe srcdoc. The srcdoc document
      inherits the page's CSP, but obfuscate.mjs only hashes the page's own
      top-level <script> tags.

   Both have happened (Kai's srcdoc engine, the /about arcade game, the blog
   card onload fade-in, the async-font onload swap). Load that code from a
   file under /scripts/ instead, and attach listeners with addEventListener.
   This is a heuristic backstop; the smoke tests' real-CSP violation check
   is the other half. */

import { glob, readFile } from 'node:fs/promises';

const DIST = new URL('../dist/', import.meta.url);
const DIST_PATH = DIST.pathname.replace(/^\/([A-Za-z]:)/, '$1');

const HANDLER_ATTR = /<[a-z][^<>]*?\son(?:load|error|click|mouse\w+|key\w+|change|input|submit|focus|blur|pointer\w+|touch\w+|animationend|transitionend)\s*=\s*["'][^"']/gi;
const HANDLER_IN_JS = /\son(?:load|error|click|mouse\w+|key\w+|change|input|submit|focus|blur|pointer\w+|touch\w+)=\\?["']/g;
// An inline <script> (no src attribute) that itself sits inside a script body
// or an entity-escaped srcdoc: i.e. markup for a nested document.
const NESTED_INLINE_SCRIPT = /(?:<|&lt;)script(?:\s+(?![^>]*\bsrc=)[^>]*)?(?:>|&gt;)\s*(?!(?:<|&lt;)\\?\/script)\S/gi;

// Not a sanitizer: this only reads our own build output, to lint the markup
// that sits outside <script> blocks. It repeats until stable anyway, and the
// end-tag pattern tolerates `</script >`, so no fragment can slip through.
const SCRIPT_BLOCK = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
function stripTopLevelScripts(html) {
  let prev;
  do {
    prev = html;
    html = html.replace(SCRIPT_BLOCK, '');
  } while (html !== prev);
  return html;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

const problems = [];

for await (const entry of glob('**/*.html', { cwd: DIST_PATH })) {
  const html = await readFile(new URL(entry, DIST), 'utf8');

  // 1. handler attributes in the page's own markup
  const markup = stripTopLevelScripts(html);
  for (const m of markup.matchAll(HANDLER_ATTR)) {
    problems.push(`${entry}: inline event handler in markup: ${m[0].slice(0, 90)}`);
  }

  // 1b + 2. inside inline <script> bodies: handler strings, nested inline scripts
  for (const s of html.matchAll(SCRIPT_BLOCK)) {
    const [, attrs, body] = s;
    if (/\bsrc=|type\s*=\s*["']?application\/(ld\+)?json/i.test(attrs)) continue;
    for (const m of body.matchAll(HANDLER_IN_JS)) {
      problems.push(`${entry}:${lineOf(html, s.index)}: inline handler inside a script string: ${body.slice(m.index, m.index + 60)}`);
    }
    for (const m of body.matchAll(NESTED_INLINE_SCRIPT)) {
      problems.push(`${entry}:${lineOf(html, s.index)}: inline <script> inside a script string (srcdoc?): ${body.slice(m.index, m.index + 60)}`);
    }
  }

  // 2b. entity-escaped srcdoc / data-srcdoc attributes
  for (const a of html.matchAll(/\s(?:data-)?srcdoc="([^"]*)"/gi)) {
    for (const m of a[1].matchAll(NESTED_INLINE_SCRIPT)) {
      problems.push(`${entry}: inline <script> inside a srcdoc attribute: ${a[1].slice(m.index, m.index + 60)}`);
    }
  }
}

for await (const entry of glob('{_astro,scripts}/**/*.js', { cwd: DIST_PATH })) {
  const js = await readFile(new URL(entry, DIST), 'utf8');
  for (const m of js.matchAll(HANDLER_IN_JS)) {
    problems.push(`${entry}: inline handler inside a JS string: ${js.slice(Math.max(0, m.index - 20), m.index + 50)}`);
  }
  for (const m of js.matchAll(NESTED_INLINE_SCRIPT)) {
    problems.push(`${entry}: inline <script> inside a JS string (srcdoc?): ${js.slice(m.index, m.index + 60)}`);
  }
}

if (problems.length) {
  console.error(`\nlint-csp: ${problems.length} inline-code pattern(s) the production CSP will block:\n`);
  for (const p of problems) console.error('  - ' + p);
  console.error('\nMove the code into a /scripts/ file and use addEventListener. See the header of scripts/lint-csp.mjs.\n');
  process.exit(1);
}
console.log('lint-csp: no CSP-blocked inline patterns found.');

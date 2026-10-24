/* Field Notes as an RSS 2.0 feed: the same posts as the blog index (English
   originals, no drafts), newest first. Linked from the blog index's <head>. */
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

const SITE_URL = 'https://samuelabhinav.com';

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const GET: APIRoute = async () => {
  const posts = (await getCollection('blog', ({ id, data }) => !data.draft && !id.includes('/'))).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
  const items = posts.map((p) => {
    const url = `${SITE_URL}/blog/${p.id}/`;
    return `    <item>
      <title>${xml(p.data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${xml(p.data.description)}</description>
      <category>${xml(p.data.category)}</category>
      <pubDate>${p.data.pubDate.toUTCString()}</pubDate>
    </item>`;
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Field Notes</title>
    <link>${SITE_URL}/blog/</link>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <description>How passwords, hashing, encryption and firewalls came to be, told from first principles, plus threat-intel writeups. By Samuel Abhinav.</description>
    <language>en</language>
    ${posts[0] ? `<lastBuildDate>${posts[0].data.pubDate.toUTCString()}</lastBuildDate>` : ''}
${items.join('\n')}
  </channel>
</rss>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};

import type { CollectionEntry } from 'astro:content';

/* The card data behind every Field Notes tile, shared by the blog index and
   the "More stories" grid at the end of each post. */

type Post = CollectionEntry<'blog'>;

const WPM = 230;
/* Tiles share a width but not a height: each takes the next ratio in this
   cycle, so a row's frames end at slightly different lines. Same cycle in
   blog-fieldnotes.js. */
export const RATIOS = ['16/9', '3/2', '13/9', '3/2', '29/20', '16/9', '9/7', '16/9', '3/2'];
const LEVELS = ['Basics', 'Intermediate', 'Advanced'];

/* A post's first tag names its series when other posts lead with it too
   ("Analog Dawn"); the rest of its tags are the concepts it covers. Parts are
   numbered by publish date, oldest first. `posts` is every listed post. */
export function fieldCards(posts: Post[]) {
  const seriesOf = (p: Post) => {
    const t = p.data.tags[0];
    return t && posts.filter((q) => q.data.tags[0] === t).length > 1 ? t : null;
  };
  const byDate = [...posts].sort((a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf());
  return posts.map((p) => {
    const words = (p.body || '').split(/\s+/).filter(Boolean).length;
    const series = seriesOf(p);
    const run = series ? byDate.filter((q) => q.data.tags[0] === series) : [];
    return {
      id: p.id,
      title: p.data.title,
      topic: p.data.category,
      level: p.data.level || null,
      levelN: p.data.level ? LEVELS.indexOf(p.data.level) + 1 : 0,
      concepts: series ? p.data.tags.slice(1) : p.data.tags,
      series,
      part: series ? run.indexOf(p) + 1 : 0,
      parts: run.length,
      mins: p.data.readTime || Math.max(1, Math.round(words / WPM)),
      desc: p.data.description,
      date: p.data.pubDate.toISOString(),
      href: '/blog/' + p.id + '/',
    };
  });
}

export type FieldCard = ReturnType<typeof fieldCards>[number];
export const levelsOf = (cards: FieldCard[]) => LEVELS.filter((l) => cards.some((c) => c.level === l));
export const caption = (c: FieldCard) => [c.level, c.topic].filter(Boolean).join(' · ');
export const partLabel = (c: FieldCard) => (c.series ? `${c.series} · Part ${c.part} of ${c.parts}` : '');

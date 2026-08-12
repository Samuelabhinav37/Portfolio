import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string().default('Threat Intel'),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    /** Minutes. Omit to auto-compute from word count. */
    readTime: z.number().optional(),
    tags: z.array(z.string()).default([]),
    /** MITRE technique IDs — rendered as linked pills in the hero. */
    mitre: z.array(z.string()).default([]),
    /** Filter category keys for the blog index grid (e.g. 'threatintel',
     *  'dfir', 'detect') — see src/data/blog-categories.ts for the full key
     *  list. Defaults to ['threatintel'] since every post on this blog
     *  qualifies for it. */
    cats: z.array(z.string()).default(['threatintel']),
    /** Path under /public, e.g. /images/supply-chain-hero.jpg */
    heroImage: z.string().optional(),
    /** Required once heroImage is set — screen readers get nothing otherwise. */
    heroImageAlt: z.string().optional(),
    heroCredit: z.string().optional(),
    /** Social card. Defaults to /og/<slug>.png */
    ogImage: z.string().optional(),
    /** Thumbnail used when this post appears in "More stories". */
    cardImage: z.string().optional(),
    /** Required once cardImage is set — screen readers get nothing otherwise. */
    cardImageAlt: z.string().optional(),
    /** Single source for both the visible accordion and FAQPage JSON-LD. */
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    /** Slugs of posts to show under "More stories". */
    related: z.array(z.string()).default([]),
    /** Side-rail "Also in ..." card. */
    alsoBy: z
      .object({
        label: z.string().default('Also in Lab Notes'),
        title: z.string(),
        meta: z.string(),
        href: z.string(),
        image: z.string().optional(),
        imageAlt: z.string().optional(),
      })
      .optional(),
    draft: z.boolean().default(false),
  })
    .refine((d) => !d.heroImage || !!d.heroImageAlt, {
      message: 'heroImageAlt is required when heroImage is set',
      path: ['heroImageAlt'],
    })
    .refine((d) => !d.cardImage || !!d.cardImageAlt, {
      message: 'cardImageAlt is required when cardImage is set',
      path: ['cardImageAlt'],
    }),
});

export const collections = { blog };

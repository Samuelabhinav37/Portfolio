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

/** Case studies at /projects/<id>/. Facts here should trace back to the
 *  project's own repo (README, status docs, tests), not to marketing copy. */
const projects = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    /** One-sentence summary: the hero dek, meta description and card text. */
    description: z.string(),
    /** Hero label, e.g. "Detection engineering". */
    category: z.string(),
    /** Shown beside the category, e.g. "2026" or "Feb – Aug 2026". */
    period: z.string(),
    /** One line on where the project stands today, kept honest. */
    status: z.string(),
    role: z.string(),
    stack: z.array(z.string()).default([]),
    /** Headline numbers for the strip under the hero. Keep each one sourced. */
    metrics: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
    links: z.array(z.object({ label: z.string(), href: z.string().url() })).default([]),
    mitre: z.array(z.string()).default([]),
    heroImage: z.string(),
    heroImageAlt: z.string(),
    /** Intrinsic size; only needed for formats webpDims can't read (SVG). */
    heroWidth: z.number().optional(),
    heroHeight: z.number().optional(),
    /** Position on /projects/ and in "More projects". Lower comes first. */
    order: z.number(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, projects };

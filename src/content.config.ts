import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string().default('Threat Intel'),
    /** How much the post assumes: shown on the blog index hover card. */
    level: z.enum(['Basics', 'Intermediate', 'Advanced']).optional(),
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
    /** Link-preview image for shares, e.g. /images/my-post.og.jpg. Posts show no pictures on the site. */
    ogImage: z.string().optional(),
    /** Required once ogImage is set — screen readers get nothing otherwise. */
    ogImageAlt: z.string().optional(),
    /** Single source for both the visible accordion and FAQPage JSON-LD. */
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    draft: z.boolean().default(false),
  })
    .refine((d) => !d.ogImage || !!d.ogImageAlt, {
      message: 'ogImageAlt is required when ogImage is set',
      path: ['ogImageAlt'],
    }),
});

export const collections = { blog };

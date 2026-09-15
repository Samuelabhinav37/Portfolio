# Redesign — what's left after the reference sites are mined

Date: 2026-09-04
Status: research only, no code decision made yet

## Headline finding: the three reference sites are tapped out

Re-checked leerob.com and conordewey.com live (not from memory/screenshots).
Neither has anything left for us to borrow structurally:

| Site | Actually has | Doesn't have |
| --- | --- | --- |
| leerob.com | Home bio, a "Notes" topic index, chronological blog. Contact is just an X link + one email for angel-investing inquiries. | No projects page, no résumé/CV link, no "now"/"uses"/guestbook page. |
| conordewey.com | Home bio + separate `/about`, recent-writing (3 posts) + "All posts →" archive, inline Twitter/LinkedIn/GitHub. | No case-study pages — past roles are one line each in the bio. No résumé, newsletter, testimonials, now/uses page. |

We've already taken the useful device from each (Inter/tracking/shade-hierarchy
from leerob, inline-socials + recent/archive split from Conor, island nav from
Aakanksha). There's nothing more to mine from these three — continuing to
compare against them has hit diminishing returns.

## Where the real leverage is now

Search on 2026 security-hiring-portfolio guidance (foliox.me and others)
converges on the same short list, independent of any of the three reference
sites: **a clear specialty line, 3–5 real proof-of-work write-ups (not
one-paragraph summaries), certs with context, and a résumé that actually
matches the specialty claimed.** That's a content problem, not a layout
problem — the minimalist layout is already the right container for it.

## Prioritized punch list

1. **Real case-study pages for Sentinel/Prism/Axon.** Highest leverage of
   anything on this list. Current artifact shows one paragraph each; the
   guidance is explicit — problem → approach → stack → measurable outcome,
   with real detail, not a summary. This is the gap no amount of further
   leerob/Conor-style polish fixes.
2. **Wire the résumé link to a real file.** Still `resume.pdf` 404ing.
3. **Resolve the specialization mismatch** (still open from the earlier
   audit): pick "security engineer" or "creative technologist," not both —
   now more urgent since the case studies above will make the claim concrete.
4. **Plan the Astro conversion path**: how the artifact's `#blog` hash-view
   maps onto the real `/blog` + `/blog/[...slug]` routes, whether
   `BlogPost.astro` itself should adopt this same restrained typography for
   consistency, and OG-image regeneration once the visual language changes.
5. **Minor — Kai's canned answers are thin** (4 Q&A pairs) now that she's a
   small chat companion instead of the old canvas widget. Not broken, just
   worth 2–3 more real facts (certs, location, availability) if she stays in
   the final design — a judgment call, not a fix.

## Sources

- https://leerob.com/ (fetched live, 2026-09-04)
- https://www.conordewey.com/ (fetched live, 2026-09-04)
- https://foliox.me/portfolio-for/cybersecurity-professionals
- https://www.sitebuilderreport.com/inspiration/software-engineer-portfolios
- https://www.sitebuilderreport.com/inspiration/engineer-portfolios

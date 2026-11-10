# Blog posts as old novel pages (2026-11-10)

Reference: a classic novel page (Sherlock Holmes, "Chapter 1 / Mr. Sherlock Holmes"): cream paper, one dark ink, a book serif, justified and hyphenated text, a centred bold chapter heading.

## How printed novels are set
- Body justified with hyphenation on. Turning hyphenation off is a known small-press mistake; justified text without it opens wide word gaps ([World's Greatest Book](https://theworldsgreatestbook.com/book-design-basics-hyphens-justification/), [Made Good Designs](https://madegooddesigns.com/book-typography/)).
- Paragraphs: an indent or a space, never both ([The Book Designer](https://www.thebookdesigner.com/?p=20737), [Typography for Lawyers](https://typographyforlawyers.com/summary-of-key-rules.html)). Fiction mostly indents; the reference uses spaces, so we follow the reference.
- The first paragraph of a chapter is flush, often opened with a drop capital and small caps ([W3C dpub Latin requirements](https://www.w3.org/TR/2014/WD-dpub-latinreq-20140313/), [Prince text formatting](https://princexml.com/doc/11/text-formatting)).
- On the web `text-align: justify` + `hyphens: auto` now works in every browser, with `hyphenate-limit-chars` to stop short fragments; it breaks down on narrow columns ([Cloud Four](https://cloudfour.com/thinks/justified-text-better-than-expected/), [CSS Secrets](https://www.oreilly.com/library/view/css-secrets/9781449372736/ch05.html)).
- Aged paper sits around #f3ebd8 to #fcf5e5 ([colorswall paper aging](https://colorswall.com/palette/578859), [parchment #fcf5e5](https://hexcolor.pages.dev/colors/fcf5e5)).

## What we built
- Paper replaces the sky on post pages only: day #f3eee3 off-white with the Contact postcard's aged-paper tile (stains, foxing, fibres, grain) and darker edges; night #0d0c0b black with the same tile turned into faint pale specks. One ink per theme.
- Text in EB Garamond: justified, hyphenated, old-style figures, ligatures; phones go ragged right.
- Sections as chapters: "Chapter N" over each H2, centred, bold (CSS counter; "Capítulo" in Spanish). H3s centred italic.
- Opening: the Dropcap component draws a drop capital again, with the first line in small caps.
- Headline, labels and date in the book face; diagrams printed in the page ink instead of dark panels. Code blocks stay dark.

## Second pass: measure, spacing and book parts
- Measure: 660px column, about 66 characters a line (books run 60-70; the old 800px ran 90+). Line height 1.5, half a line between paragraphs, chapter headings with a line and more of room.
- Intro set as an epigraph (narrow, italic, centred); the section list as a Contents page with roman numerals; `hr` as a three-star scene break; hanging punctuation where the browser has it.
- A page number in the bottom bar (one page per screen of reading), like the folio at the foot of the reference page; a paper band at the top so text scrolls under paper, not the nav.

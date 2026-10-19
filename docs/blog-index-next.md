# Blog index (Field Notes): follow-ups

## To do: styled animations on a few post thumbnails

The redesigned index ships with still images on every card. Later, add
animation to a **few** posts only (not all), in the style of
[ipshita.dev](https://www.ipshita.dev/#play)'s live thumbnails.

Notes from the first attempt (preview, October 2026):

- Draw the animation **over the real card art**, in its own ASCII-dot
  language, rather than replacing the image. What was tried: a soft scan beam
  sweeping down, mono glyphs twinkling in the image's own colours, and a short
  horizontal glitch every few seconds.
- Candidates tried: Floppy Disk Cold, Medieval Firewall, Digital Handshake.
- Mark animated cards (a small "LIVE" badge was used), run only while the card
  is on screen, and draw one still frame under `prefers-reduced-motion`.

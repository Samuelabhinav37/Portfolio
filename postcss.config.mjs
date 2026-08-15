import globalData from '@csstools/postcss-global-data';
import customMedia from 'postcss-custom-media';

// globalData makes the @custom-media names in src/styles/breakpoints.css
// (--bp-820 etc.) visible to every CSS file Vite processes — .astro
// <style> blocks included — without a manual @import per file, and without
// injecting any of that file's own rules into the output. customMedia then
// resolves `@media (--bp-820)` down to the plain `@media (max-width: 820px)`
// it stands in for. Order matters: globalData must run first.
export default {
  plugins: [
    globalData({ files: ['src/styles/breakpoints.css'] }),
    customMedia(),
  ],
};

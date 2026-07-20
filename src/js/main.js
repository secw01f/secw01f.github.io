// Progressive enhancement for the pre-rendered site.
// The pages are fully static HTML; this only adds niceties on top:
//   - typed hero prompt
//   - copy buttons + language tabs on code blocks
//   - tag filtering on the home feed
//   - Cmd-K command palette
//   - active-nav highlighting for the current section
// If this script fails to load, every page still renders and navigates fine.

import { initHero } from "./hero.js";
import { enhanceCodeBlocks } from "./copy-code.js";
import { initFilter } from "./filter.js";
import { initPalette } from "./palette.js";
import { markActiveNav } from "./nav.js";

function init() {
  initHero();
  enhanceCodeBlocks();
  initFilter();
  initPalette();
  markActiveNav();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

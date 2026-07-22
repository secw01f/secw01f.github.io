// =============================================================
// secw01f blog build
//
// Content model:
//   The backend populates a post-type template with a post and commits the
//   result to src/content/*. Each committed file IS the page source — real,
//   themed HTML — with metadata carried as data-* attributes on the root
//   <article>. There is no JSON (or Markdown) source of truth for a post.
//
// This build ("compilation by the Action") does NOT re-render post-type
// templates. It reads the data-* metadata, wraps each populated article in
// the site shell, compiles the home feed, and emits feeds/sitemap.
//
// Steps:
//   1. clean dist
//   2. bundle + minify + hash JS/CSS (esbuild)
//   3. inject the astro theme vars into the base shell
//   4. read + validate each post's data-* metadata against schema
//   5. wrap posts + static pages in the shell -> real URLs
//   6. compile the home feed
//   7. emit feed.xml / atom.xml / sitemap.xml / robots.txt
// =============================================================

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  existsSync,
  cpSync,
  statSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import Mustache from "mustache";
import Ajv from "ajv";
import * as esbuild from "esbuild";
import { rootCss } from "../src/theme/tokens.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const p = (...parts) => join(ROOT, ...parts);

const SITE = {
  title: "secw01f/",
  description:
    "Field notes on breaking and building things — product security, agentic security tooling, and offensive security.",
  url: "https://secw01f.github.io",
};

// ---------- small helpers ----------
const read = (rel) => readFileSync(p(rel), "utf8");

function write(distRelPath, contents) {
  const full = p("dist", distRelPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(date) {
  return new Date(`${date}T00:00:00Z`).toUTCString();
}

function rfc3339(date) {
  return new Date(`${date}T00:00:00Z`).toISOString();
}

function decodeEntities(str = "") {
  return String(str)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// A content file IS the page source: a single root <article> the backend
// populated from a template. Metadata rides on that element as data-*
// attributes (no JSON block). Returns { attrs, content } where content is
// the file's HTML verbatim and attrs is the decoded data-* map.
function parseContentFile(rel) {
  const raw = read(rel).trim();
  const open = raw.match(/<article\b([^>]*)>/i);
  if (!open) {
    throw new Error(`${rel}: expected a root <article ...> element`);
  }
  const attrs = {};
  for (const m of open[1].matchAll(/data-([\w-]+)\s*=\s*"([^"]*)"/g)) {
    attrs[m[1]] = decodeEntities(m[2]);
  }
  return { attrs, content: raw };
}

// Map the data-* attributes of a post's root <article> to the metadata
// object validated against schema/post.schema.json.
function attrsToPostMeta(attrs) {
  const meta = {};
  const map = {
    id: "id",
    type: "type",
    date: "date",
    title: "title",
    excerpt: "excerpt",
    "diff-add": "diffAdd",
    "diff-rem": "diffRem",
    severity: "severity",
    cve: "cve",
  };
  for (const [dataKey, metaKey] of Object.entries(map)) {
    if (attrs[dataKey] !== undefined) meta[metaKey] = attrs[dataKey];
  }
  if (attrs.tags !== undefined) {
    meta.tags = attrs.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return meta;
}

// ---------- 1. clean ----------
rmSync(p("dist"), { recursive: true, force: true });
mkdirSync(p("dist"), { recursive: true });

// ---------- 2. assets ----------
const bundle = await esbuild.build({
  entryPoints: {
    main: p("src/js/main.js"),
    style: p("src/css/style.css"),
  },
  bundle: true,
  minify: true,
  entryNames: "assets/[name]-[hash]",
  assetNames: "assets/[name]-[hash]",
  loader: { ".svg": "file" },
  outdir: p("dist"),
  metafile: true,
  logLevel: "warning",
});

const outputs = Object.keys(bundle.metafile.outputs).map((o) =>
  o.replace(/^.*dist\//, "").replace(/^dist\//, "")
);
const jsPath = outputs.find((o) => o.endsWith(".js"));
const cssPath = outputs.find((o) => o.endsWith(".css"));
if (!jsPath || !cssPath) {
  throw new Error(`esbuild did not emit expected assets: ${outputs.join(", ")}`);
}

// Static media (post images, etc.) committed under src/assets/ → dist/assets/.
// CMS publishes images to src/assets/posts/<slug>/…; URLs in post HTML are
// /assets/posts/<slug>/<file>.
const staticAssets = p("src/assets");
if (existsSync(staticAssets) && statSync(staticAssets).isDirectory()) {
  cpSync(staticAssets, p("dist/assets"), { recursive: true });
}

// ---------- 3. theme vars ----------
const presets = JSON.parse(read("src/theme/presets.json"));
const themeVars = rootCss(presets.astro);

// ---------- templates ----------
const base = read("src/templates/base.html");
const partials = {
  header: read("src/templates/partials/header.html"),
  footer: read("src/templates/partials/footer.html"),
};
const feedCardTpl = read("src/templates/partials/feed-card.html");
const homeTpl = read("src/templates/pages/home.html");
// Note: src/templates/post-types/* and pages/page.html are the fill-in
// contracts the backend targets. They are NOT rendered here — a committed
// content file is already the populated template.

let siteIndex = "[]";

function renderPage({ title, description, canonical, ogType, content }) {
  return Mustache.render(
    base,
    {
      title,
      description,
      canonical,
      ogType,
      themeVars,
      cssPath,
      jsPath,
      siteIndex,
      content,
    },
    partials
  );
}

// ---------- 4/5. posts ----------
const ajv = new Ajv({ allErrors: true });
const validatePost = ajv.compile(JSON.parse(read("schema/post.schema.json")));

const postsDir = "src/content/posts";
mkdirSync(p(postsDir), { recursive: true });
const postFiles = existsSync(p(postsDir))
  ? readdirSync(p(postsDir)).filter((f) => f.endsWith(".html"))
  : [];

// Parse + validate every post first, so the site index (used by the
// command palette on every page) is complete before any page renders.
const parsed = [];
for (const file of postFiles) {
  const rel = `${postsDir}/${file}`;
  const { attrs, content } = parseContentFile(rel);
  const meta = attrsToPostMeta(attrs);

  if (!validatePost(meta)) {
    const details = (validatePost.errors || [])
      .map((e) => `  ${e.instancePath || "/"} ${e.message}`)
      .join("\n");
    throw new Error(`${rel}: metadata failed schema validation:\n${details}`);
  }
  const stem = basename(file, ".html");
  if (meta.id !== stem) {
    throw new Error(`${rel}: id "${meta.id}" must match filename stem "${stem}"`);
  }
  parsed.push({ meta, content });
}

parsed.sort((a, b) =>
  a.meta.date < b.meta.date ? 1 : a.meta.date > b.meta.date ? -1 : 0
);

// Injected into every page for the Cmd-K palette. Escape "<" so a title
// can never break out of the <script> block.
siteIndex = JSON.stringify(
  parsed.map(({ meta }) => ({
    id: meta.id,
    title: meta.title,
    type: meta.type,
    date: meta.date,
    tags: meta.tags,
  }))
).replace(/</g, "\\u003c");

const posts = [];
for (const { meta, content } of parsed) {
  const canonical = `${SITE.url}/posts/${meta.id}/`;

  // content is the populated post-type template; just wrap it in the shell.
  write(
    `posts/${meta.id}/index.html`,
    renderPage({
      title: `${meta.title} — secw01f`,
      description: meta.excerpt,
      canonical,
      ogType: "article",
      content,
    })
  );

  posts.push({ ...meta, canonical });
}

// ---------- 6. home feed ----------
const feedHtml = posts
  .map((post) =>
    Mustache.render(feedCardTpl, {
      ...post,
      hasDiff: Boolean(post.diffAdd || post.diffRem),
      tagsAttr: (post.tags || []).join(" "),
    })
  )
  .join("\n");

const allTags = [...new Set(posts.flatMap((post) => post.tags || []))].sort();

// Home intro is CMS-editable via src/content/home.json (committed on publish).
const homeIntroPath = "src/content/home.json";
const homeIntro = existsSync(p(homeIntroPath))
  ? JSON.parse(read(homeIntroPath))
  : {
      term_title: "~/secw01f — bash",
      prompt_path: "~/secw01f",
      prompt_cmd: "cat about.md",
      headline: "staff security engineer, building in the open",
      bio: "",
    };

write(
  "index.html",
  renderPage({
    title: SITE.title,
    description: SITE.description,
    canonical: `${SITE.url}/`,
    ogType: "website",
    content: Mustache.render(homeTpl, {
      ...homeIntro,
      feed: feedHtml,
      tags: allTags,
      hasTags: allTags.length > 0,
      hasPosts: posts.length > 0,
    }),
  })
);

// ---------- static pages ----------
const pagesDir = "src/content/pages";
if (existsSync(p(pagesDir))) {
  for (const file of readdirSync(p(pagesDir)).filter((f) => f.endsWith(".html"))) {
    const rel = `${pagesDir}/${file}`;
    const { attrs, content } = parseContentFile(rel);
    const stem = basename(file, ".html");
    write(
      `${stem}/index.html`,
      renderPage({
        title: attrs.title || `${stem} — secw01f`,
        description: attrs.description || SITE.description,
        canonical: `${SITE.url}/${stem}/`,
        ogType: "website",
        content,
      })
    );
  }
}

// ---------- 7. feeds / sitemap / robots ----------
const rssItems = posts
  .map(
    (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${post.canonical}</link>
      <guid isPermaLink="true">${post.canonical}</guid>
      <pubDate>${rfc822(post.date)}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
    </item>`
  )
  .join("\n");

write(
  "feed.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE.title)}</title>
    <link>${SITE.url}/</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>en</language>
${rssItems}
  </channel>
</rss>
`
);

const atomEntries = posts
  .map(
    (post) => `  <entry>
    <title>${escapeXml(post.title)}</title>
    <link href="${post.canonical}"/>
    <id>${post.canonical}</id>
    <updated>${rfc3339(post.date)}</updated>
    <summary>${escapeXml(post.excerpt)}</summary>
  </entry>`
  )
  .join("\n");

const atomUpdated = posts.length ? rfc3339(posts[0].date) : rfc3339("1970-01-01");
write(
  "atom.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(SITE.title)}</title>
  <link href="${SITE.url}/"/>
  <link rel="self" href="${SITE.url}/atom.xml"/>
  <id>${SITE.url}/</id>
  <updated>${atomUpdated}</updated>
${atomEntries}
</feed>
`
);

const urls = [
  `${SITE.url}/`,
  `${SITE.url}/whoami/`,
  ...posts.map((post) => post.canonical),
];
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`
);

write(
  "robots.txt",
  `User-agent: *
Allow: /

Sitemap: ${SITE.url}/sitemap.xml
`
);

// GitHub Pages: skip Jekyll processing of the built output.
write(".nojekyll", "");

console.log(
  `built ${posts.length} post(s) -> dist/  (js: ${jsPath}, css: ${cssPath})`
);

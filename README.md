# secw01f

Personal site + blog. Source lives in this repo; GitHub Actions builds it into
static HTML and deploys to GitHub Pages. Designed so a CMS backend can author a
post, open a pull request, and — on merge — trigger the build and publish.

## How it works

```
CMS backend ──PR──▶ repo (src/content/*) ──merge──▶ GitHub Actions ──▶ GitHub Pages
                                              │
                                              └── scripts/build.mjs:
                                                  validate → render → bundle → feeds
```

- **`src/content/*`** is the source of truth a CMS writes: one HTML file per post
  or page. Each file is a **populated template** — real, themed page markup — with
  its metadata carried as `data-*` attributes on the root `<article>`. No JSON, no
  Markdown.
- **`src/templates/*`** is the shared design system. `base.html`, the partials,
  and `pages/home.html` are compiled by the build; `post-types/*` and
  `pages/page.html` are the **fill-in contracts the backend targets** (the build
  does not re-render them).
- **`dist/*`** is the built site. It is produced by the build (gitignored) and
  deployed by CI — never hand-committed.

The backend populates a post-type template with a post and opens a PR; the Action
compiles that source (wraps it in the shell, bundles assets, builds the feed and
RSS) and deploys.

## Structure

```
src/
  content/
    posts/<id>.html      post source (CMS output)
    pages/whoami.html    static page source
  templates/
    base.html            page shell (head, header, footer)
    partials/            header, footer, feed-card
    post-types/          writeup.html, notes.html, advisory.html
    pages/               home.html, page.html
  theme/
    presets.json         astro color scheme (ported from secw01f-ui)
    tokens.js            schemeToCssVars() + rootCss() (the --template-* contract)
  js/                    progressive enhancement (copy buttons, active nav)
  css/style.css          astro-themed styles
schema/post.schema.json  metadata contract (validated at build time)
scripts/build.mjs        the build
.github/workflows/deploy.yml  PR build check + deploy on merge to main
```

## Post source contract

Each `src/content/posts/<id>.html` is the post-type template already populated by
the backend. The root element is a single `<article>` whose `data-*` attributes
carry the metadata; the rest is the themed page markup. The filename stem must
equal `data-id`.

```html
<article class="post type-writeup"
  data-id="astro-scheduler"
  data-type="writeup"
  data-date="2026-06-05"
  data-title="Shipping ASTRO's Scheduler"
  data-excerpt="One or two sentences for the feed card."
  data-tags="astro,automation"
  data-diff-add="what this post adds"
  data-diff-rem="what this post removes">
  <a href="/" class="back-link">← log/</a>
  <div class="post-meta"><span>2026-06-05</span><span class="tag tag-type">writeup</span></div>
  <h1 class="post-title">Shipping ASTRO's Scheduler</h1>
  <div class="body">
    <p>Post body as HTML…</p>
    <pre data-lang="python">code block</pre>
  </div>
  <div class="post-tags"><span class="tag">astro</span><span class="tag">automation</span></div>
</article>
```

Notes:

- `data-*` values are attribute-encoded (`&`→`&amp;`, `"`→`&quot;`, `>`→`&gt;`);
  `data-tags` is comma-separated.
- The build reads only the `data-*` attributes (mapped to `diffAdd`/`diffRem`
  etc.) and validates them against [`schema/post.schema.json`](schema/post.schema.json).
  Malformed metadata fails CI before it can merge. It then wraps the article in
  the site shell — it does not otherwise touch the markup.
- The exact shape per type lives in
  [`src/templates/post-types/`](src/templates/post-types); that's what the backend
  fills in.

### Post types

| `type`     | Extra required fields | Renders |
|------------|-----------------------|---------|
| `writeup`  | `diffAdd`, `diffRem`  | `+/-` diff eyebrow above the title |
| `notes`    | —                     | plain meta line |
| `advisory` | `severity`            | severity badge (+ optional `cve`), optional diff |

Add a new type by creating a `src/templates/post-types/<type>.html` contract and
adding it to the `type` enum in [`schema/post.schema.json`](schema/post.schema.json)
(with any type-specific required `data-*` fields). The build stays untouched.

Static pages (e.g. `src/content/pages/whoami.html`) are a root
`<article class="page" data-title="…" data-description="…">` and render to
`/<name>/`.

## Theming

The site uses the **astro** dark theme ported from
[secw01f-ui](https://github.com/secw01f/secw01f-ui) (`src/theme/tokens.ts`). The
color scheme lives in [`src/theme/presets.json`](src/theme/presets.json) and is
flattened into `--template-*` CSS variables that the build inlines into every
page's `<head>` (correct theme on first paint, no runtime work). Keep the palette
in sync with secw01f-ui when it changes.

## Local development

```bash
npm install
npm run build      # build to dist/
npm run preview    # build, then serve dist/ at http://localhost:8080
```

## Deployment

Push/PR runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

- **Pull requests** run `npm ci && npm run build` as a check (validates content).
- **Merge to `main`** builds and deploys `dist/` to GitHub Pages via
  `upload-pages-artifact` + `deploy-pages`.

In the repo settings, set **Pages → Build and deployment → Source** to
**GitHub Actions**.

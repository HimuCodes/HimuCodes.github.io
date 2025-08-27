# himu.me Static Site

Minimal custom static site generator (SSG) wired to Obsidian-compatible markdown notes.

## Features
- Auto-detected `about.md` (notes/about.md) – no frontmatter required
- All notes published by default (set `publish: false` to hide)
- Draft handling (`draft: true`, include with `--drafts` flag)
- Future posts skipped unless `--future` flag
- Reading time + word count + updated (git last modified)
- Tag pages + per-tag RSS feeds (`/tags/<tag>/feed.xml`)
- Global RSS (RSS 2.0) with full HTML content
- WebP image optimization + lazy loading + `<picture>` fallback
- Critical CSS inlining + hashed asset fingerprinting + HTML/CSS/JS minify
- Incremental builds (hash-based) + build manifest cache
- Broken internal link checker (optional failing mode)
- Copy code buttons, heading anchors, interactive footnotes (popover style)
- OG + Twitter image auto-generation (SVG→PNG) per post
- Optional pre-generation of all OG images (`npm run og`)
- Tag RSS links & RSS badge in navbar
- Draft watermark overlay in `--drafts` mode
- Git last modified date per post
- Auto-sync watcher with git commit & push (`npm run sync:push`)

## Directory Layout
```
notes/
  about.md            # About page
  posts/              # Blog posts (.md)
public/               # Static assets (copied through)
public/og/            # Pre-generated OG images (optional)
css/, js/, src/       # Styles, scripts, templates
scripts/              # Helper scripts (new post, og images, auto-sync)
```

## Frontmatter Fields
| Field        | Type        | Notes |
|--------------|-------------|-------|
| title        | string      | Fallback: filename |
| date         | YYYY-MM-DD  | Fallback: build date |
| slug         | string      | Auto slugified from title |
| draft        | boolean     | Hidden unless `--drafts` |
| publish      | boolean     | `false` to force hide |
| tags         | array/list  | Lowercased, used for tag pages & tag feeds |
| excerpt      | string      | Fallback: first non-empty line |

`about.md` automatically becomes /about/ unless `publishAbout: false`.

## Commands
| Command | Description |
|---------|-------------|
| `npm run build` | Production build (no drafts/future) |
| `npm run dev` | Build then watch & serve (no drafts by default) |
| `npm run watch` | Watch with drafts visible |
| `npm run sync` | Watch with drafts, future, strict link checking (no auto git) |
| `npm run sync:push` | Watch + auto git commit/push (drafts + future) |
| `npm run new -- "Title" [--draft] [--tags=a,b]` | Create a new post file (non-interactive) |
| `npm run new:interactive` | Interactive wizard to create a new post |
| `npm run og` | Pre-generate OG images into `public/og/` |
| `npm run build:all` | `og` then `build` |
| `npm test` | Run build/incremental & validation tests |

## Build Flags
Add after `node build.mjs` or via scripts:
- `--drafts` include draft posts
- `--future` include future-dated posts
- `--strict-links` fail build on broken internal links
- `--base=/repo` rewrite internal links (GitHub Pages project sites)

Environment:
- `SITE_ORIGIN` (e.g. `https://himu.me`) enables absolute canonical URLs + sitemap full URLs.

## Adding a Post
Non-interactive:
```
npm run new -- "My Cool Post" --tags=rust,networking
```
Interactive wizard:
```
npm run new:interactive
```
Prompts for title, date (defaults today), slug (auto), tags, draft flag, then opens the file in $EDITOR (or Notepad on Windows).

## OG Images
- On build: each post gets an OG image generated on demand (placed in `dist/og/`).
- Pre-generate for caching/CDN: `npm run og` (creates `public/og/*.png`). Future builds use these.

## Drafts Workflow
1. Mark with `draft: true`.
2. Use `npm run watch` while writing (shows watermark + label).
3. Remove draft flag to publish.

## Auto Sync
```
npm run sync:push
```
Watches notes & `public/og`, builds incrementally, commits + pushes after debounced changes.

## Validation
- Missing title/date: warning (non-fatal)
- Broken links: reported; add `--strict-links` to exit non-zero
- Drafts excluded from RSS & tag feeds

## Deployment (GitHub Pages)
Workflow `.github/workflows/deploy.yml` runs:
1. `npm ci`
2. `npm run og`
3. `npm test`
4. `npm run build -- --strict-links`
5. Upload & deploy

## Footnotes
Use standard Markdown footnote style:
```
Text with reference[^id]

[^id]: Definition here.
```
Rendered as click-toggle popovers.

## Known Limits / TODO
- No full-text search (possible future enhancement)
- No comment system (intentionally skipped)
- No image resizing beyond WebP conversion

## Troubleshooting
| Issue | Fix |
|-------|-----|
| Sharp not installed | Re-run `npm install` (native build may need tools) |
| OG images SVG only | Sharp missing; install build tools (Python, VS Build Tools on Windows) |
| Build fails strict links | Run `npm run build` without `--strict-links` to inspect, fix missing page/typo |
| Draft unexpectedly published | Ensure file doesn’t set `draft: true` removed, and build wasn't run with `--drafts` |

## License
Personal site code – reuse patterns freely; content (markdown) © himu.

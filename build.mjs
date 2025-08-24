#!/usr/bin/env node
/**
 * Build script: transforms Obsidian notes into a static site.
 * Usage:
 *   npm run build
 *   npm run dev  (with --watch --serve)
 * Flags:
 *   --watch : watch notes & rebuild
 *   --serve : start a static server (default port 4321)
 *   --base=/myrepo : set SITE_BASE for GitHub project pages (links become /myrepo/...)
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import slugify from 'slugify';
import fg from 'fast-glob';
import chokidar from 'chokidar';
import http from 'http';
import serveStatic from 'serve-static';
import finalhandler from 'finalhandler';
import mime from 'mime';

const __root = process.cwd();
const DIST = path.join(__root, 'dist');
const NOTES_DIR = path.join(__root, 'notes');
const PUBLIC_DIR = path.join(__root, 'public');
const CSS_DIR = path.join(__root, 'css');
const JS_DIR = path.join(__root, 'js');
const SITE_BASE = (process.argv.find(a => a.startsWith('--base=')) || '').split('=')[1] || ''; // e.g. /myrepo
const WATCH = process.argv.includes('--watch');
const SERVE = process.argv.includes('--serve');

if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

/* ---------- Utility helpers ---------- */
const ensureDir = p => fs.mkdirSync(p, { recursive: true });
const write = (file, content) => {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content);
};
const copy = (src, dest) => {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
};
const copyTree = (srcDir, destDir) => {
  if (!fs.existsSync(srcDir)) return;
  const entries = fg.sync('**/*', { cwd: srcDir, dot: true });
  entries.forEach(f => {
    const from = path.join(srcDir, f);
    const to = path.join(destDir, f);
    if (fs.lstatSync(from).isDirectory()) return;
    ensureDir(path.dirname(to));
    fs.copyFileSync(from, to);
  });
};

const sanitizeSlug = (s) =>
    slugify(s, { lower: true, strict: true, remove: /[*+~.()'"!:@?]/g });

/* ---------- Templates ---------- */
import layout from './src/templates/layout.js';
import { nav } from './src/templates/component.js';

/* ---------- Markdown / Content Processing ---------- */
function collectNotes() {
  const mdFiles = fg.sync('**/*.md', { cwd: NOTES_DIR, ignore: ['attachments/**'] });
  const posts = [];
  let aboutNote = null;

  mdFiles.forEach(rel => {
    const full = path.join(NOTES_DIR, rel);
    const raw = fs.readFileSync(full, 'utf8');
    const { data: fm, content } = matter(raw);
    const tags = Array.isArray(fm.tags) ? fm.tags.map(t => String(t).toLowerCase()) :
        (typeof fm.tags === 'string' ? fm.tags.split(/[, ]+/).map(t => t.toLowerCase()) : []);
    const shouldPublish = fm.publish === true || fm.publishAbout === true || tags.includes('publish');
    if (!shouldPublish || fm.draft === true) return;

    const title = fm.title || rel.replace(/\.md$/, '');
    const date = fm.date || new Date().toISOString().slice(0, 10);
    const slug = fm.slug ? sanitizeSlug(fm.slug) : sanitizeSlug(title);
    const excerpt = (fm.excerpt || content.split('\n').find(l => l.trim()).slice(0, 240)).trim();
    const postMeta = { slug, title, date, excerpt, tags, pathRel: rel };

    if (fm.publishAbout) {
      aboutNote = { ...postMeta, content };
    } else {
      posts.push({ ...postMeta, content });
    }
  });

  posts.sort((a, b) => b.date.localeCompare(a.date));
  return { posts, aboutNote };
}

function renderMarkdown(md) {
  return marked.parse(md, {
    mangle: false,
    headerIds: true
  });
}

/* ---------- Build Steps ---------- */
function buildSite() {
  console.log('• Building site...');
  fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);

  copyTree(PUBLIC_DIR, path.join(DIST));
  copyTree(CSS_DIR, path.join(DIST, 'css'));
  copyTree(JS_DIR, path.join(DIST, 'js'));
  // Copy attachments (if any)
  copyTree(path.join(NOTES_DIR, 'attachments'), path.join(DIST, 'attachments'));

  const { posts, aboutNote } = collectNotes();

  // posts.json
  write(path.join(DIST, 'content', 'posts.json'), JSON.stringify(
      posts.map(p => ({
        slug: p.slug, title: p.title, date: p.date, excerpt: p.excerpt, tags: p.tags
      })), null, 2));

  // Home
  const homeList = `
    <ul class="home-links">
      <li><a href="${SITE_BASE}/about/"><span class="arrow">›</span> About Me</a></li>
      <li><a href="${SITE_BASE}/blog/"><span class="arrow">›</span> Blog</a></li>
    </ul>
  `;
  write(path.join(DIST, 'index.html'),
      layout({
        title: 'home',
        active: '/home/',
        body: homeList,
        base: SITE_BASE
      })
  );

  // About
  const aboutHTML = aboutNote
      ? `<article class="markdown">${renderMarkdown(aboutNote.content)}</article>`
      : `<article class="markdown"><h1>About</h1><p>Add an <code>about.md</code> with <code>publishAbout: true</code> frontmatter inside notes/ to populate this page.</p></article>`;
  write(path.join(DIST, 'about', 'index.html'),
      layout({
        title: 'about',
        active: '/about/',
        body: aboutHTML,
        base: SITE_BASE
      })
  );

  // Blog Index
  const blogList = `
    <ul class="post-list">
      ${posts.map(p => `
        <li>
          <a href="${SITE_BASE}/blog/${p.slug}/">
          <span class="arrow">›</span> ${p.date} - ${p.title}
          </a>
        </li>`).join('\n')}
    </ul>`;
  write(path.join(DIST, 'blog', 'index.html'),
      layout({
        title: 'blog',
        active: '/blog/',
        body: blogList,
        base: SITE_BASE
      })
  );

  // Each post
  posts.forEach(p => {
    const html = renderMarkdown(p.content);
    const body = `
      <article class="markdown">
        ${html}
      </article>
      <nav class="post-nav">
        <a href="${SITE_BASE}/blog/">&larr; Back to Blog</a>
      </nav>`;
    write(path.join(DIST, 'blog', p.slug, 'index.html'),
        layout({
          title: p.title,
          active: '/blog/',
          body,
          base: SITE_BASE,
          headingOverride: p.title
        })
    );

    // Also copy the markdown file for client-side loading
    write(path.join(DIST, 'content', 'posts', `${p.slug}.md`), p.content);
  });

  console.log(`✔ Build complete: ${posts.length} posts`);
}

buildSite();

/* ---------- Watch / Serve ---------- */
if (WATCH) {
  console.log('• Watching notes for changes...');
  chokidar.watch([NOTES_DIR, CSS_DIR, JS_DIR, PUBLIC_DIR], {
    ignoreInitial: true
  }).on('all', (evt, file) => {
    console.log(`↻ Change (${evt}): ${path.relative(__root, file)}`);
    try {
      buildSite();
    } catch (e) {
      console.error('Build error:', e);
    }
  });
}

if (SERVE) {
  const serve = serveStatic(DIST, {
    setHeaders(res, p) {
      const type = mime.getType(p);
      if (type) res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'no-cache');
    }
  });
  const port = 4321;
  http.createServer((req, res) => {
    serve(req, res, finalhandler(req, res));
  }).listen(port, () => {
    console.log(`• Dev server: http://localhost:${port}${SITE_BASE || ''}`);
  });
}
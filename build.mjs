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
// New deps
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { minify as minifyHTML } from './src/minify-html.js';
import * as csso from 'csso';
import esbuild from 'esbuild';
import { spawnSync } from 'child_process';
import { getHighlighter } from 'shiki';

const __root = process.cwd();
const DIST = path.join(__root, 'dist');
const NOTES_DIR = path.join(__root, 'notes');
const PUBLIC_DIR = path.join(__root, 'public');
const CSS_DIR = path.join(__root, 'css');
const JS_DIR = path.join(__root, 'js');
const CACHE_DIR = path.join(__root, '.cache');
const MANIFEST_FILE = path.join(CACHE_DIR, 'build-manifest.json');
const SITE_BASE = (process.argv.find(a => a.startsWith('--base=')) || '').split('=')[1] || '';
const WATCH = process.argv.includes('--watch');
const SERVE = process.argv.includes('--serve');
const FUTURE = process.argv.includes('--future');
const DRAFTS = process.argv.includes('--drafts');
const STRICT_LINKS = process.argv.includes('--strict-links') || process.env.STRICT_LINKS === 'true';
const SITE_ORIGIN = process.env.SITE_ORIGIN || ''; // e.g. https://himu.me (optional)

if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// Build config (extendable)
const CONFIG = {
  readingWPM: 200,
  plausibleDomain: 'himu.me',
  rss: { title: 'himu — blog feed', description: 'himu posts', author: 'himu' },
  criticalSelectors: ['html','body','.site-header','.brand','.main-nav','canvas#starfield','canvas#glstars','canvas#shooting','h1','.content','.logo']
};

/* ---------- Utility helpers ---------- */
const ensureDir = p => fs.mkdirSync(p, { recursive: true });
const write = (file, content) => { ensureDir(path.dirname(file)); fs.writeFileSync(file, content); };
const copy = (src, dest) => { ensureDir(path.dirname(dest)); fs.copyFileSync(src, dest); };
const copyTree = (srcDir, destDir) => { /* unchanged */ if (!fs.existsSync(srcDir)) return; const entries = fg.sync('**/*', { cwd: srcDir, dot: true }); entries.forEach(f => { const from = path.join(srcDir, f); const to = path.join(destDir, f); if (fs.lstatSync(from).isDirectory()) return; ensureDir(path.dirname(to)); fs.copyFileSync(from, to); }); };
const sanitizeSlug = s => slugify(s, { lower: true, strict: true, remove: /[*+~.()'"!:@?]/g });
const hashContent = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);

/* ---------- Footnotes + Markdown Processing ---------- */
function preprocessMarkdown(raw){
  const lines = raw.split(/\r?\n/);
  const footnotes = {}; const remainder = [];
  const defRe = /^\[\^(.+?)\]:\s*(.*)$/; // correct footnote def pattern
  lines.forEach(l=>{ const m=l.match(defRe); if(m){ footnotes[m[1]]=m[2].trim(); } else remainder.push(l); });
  let content = remainder.join('\n');
  const order=[];
  content = content.replace(/\[\^(.+?)\]/g, (_, id)=>{ if(!order.includes(id)) order.push(id); const idx = order.indexOf(id)+1; return `<button type="button" class="fn-ref" id="fnref-${id}" data-fn="${id}" aria-expanded="false">[${idx}]</button>`; });
  return { content, footnotes, order };
}

let _cachedHighlighter = null;
async function ensureHighlighter(){
  if (_cachedHighlighter) return _cachedHighlighter;
  _cachedHighlighter = await getHighlighter({ themes: ['github-dark-default'], langs: ['javascript','typescript','json','bash','markdown','html','css','plaintext'] });
  return _cachedHighlighter;
}

function renderMarkdownWithExtrasSync(md){
  const { content, footnotes, order } = preprocessMarkdown(md);
  const renderer = new marked.Renderer();
  const highlighter = _cachedHighlighter;
  renderer.code = (code, infostring) => {
    let lang = (infostring||'').split(/\s+/)[0] || 'text';
    const alias = { js:'javascript', jsx:'javascript', ts:'typescript', tsx:'typescript', sh:'bash', shell:'bash', bash:'bash', cjs:'javascript', mjs:'javascript', json5:'json' };
    const origLang = lang.toLowerCase(); if(alias[origLang]) lang = alias[origLang];
    if (highlighter){ try { return highlighter.codeToHtml(code, { lang, theme:'github-dark-default' }); } catch {} }
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  };
  const html = marked.parse(content, { mangle:false, headerIds:true, renderer });
  const hiddenDefs = Object.keys(footnotes).length ? `<div class="footnote-defs" hidden>${Object.entries(footnotes).map(([id,txt])=>`<div data-fn-def="${id}">${escapeHtml(txt)}</div>`).join('')}</div>`: '';
  const footList = order && order.length ? `<section class="footnotes"><ol>${order.map(id=> `<li id="fn-${id}">${escapeHtml(footnotes[id]||'')} <a href="#fnref-${id}" class="fn-back" aria-label="Back to reference">↩</a></li>`).join('')}</ol></section>`: '';
  return html + hiddenDefs + footList;
}

/* ---------- Content Collection ---------- */
function collectNotes(){
  const mdFiles = fg.sync('**/*.md', { cwd: NOTES_DIR, ignore:['attachments/**'] });
  const posts = []; let aboutNote = null; const now = new Date().toISOString().slice(0,10);
  mdFiles.forEach(rel => {
    const full = path.join(NOTES_DIR, rel);
    const raw = fs.readFileSync(full, 'utf8');
    const parsed = matter(raw);
    const fm = parsed.data || {};
    const content = parsed.content || raw; // if no frontmatter
    const baseName = path.basename(rel).toLowerCase();
    const tags = Array.isArray(fm.tags) ? fm.tags.map(t=>String(t).toLowerCase()) : (typeof fm.tags === 'string'? fm.tags.split(/[, ]+/).map(t=>t.toLowerCase()):[]);
    const isAbout = fm.publishAbout === true || (baseName === 'about.md' && fm.publishAbout !== false);
    const explicitPublishFlag = fm.publish;
    const shouldPublish = isAbout || explicitPublishFlag !== false;
    if (!shouldPublish) return;
    const isDraft = fm.draft === true;
    if (isDraft && !DRAFTS) return;
    const title = fm.title || rel.replace(/\.md$/, '');
    let dateRaw = fm.date || now;
    if (dateRaw instanceof Date) dateRaw = dateRaw.toISOString().slice(0,10);
    let date = String(dateRaw).slice(0,10);
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) { // fallback if malformed
      try { date = new Date(dateRaw).toISOString().slice(0,10); } catch { date = now; }
    }
    if (!FUTURE && date > now) return;
    const slug = isAbout ? 'about' : (fm.slug ? sanitizeSlug(fm.slug) : sanitizeSlug(title));
    const excerpt = (fm.excerpt || content.split('\n').find(l=>l.trim()) || '').slice(0, 240).trim();
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const readingTimeMin = Math.max(1, Math.round(wordCount / CONFIG.readingWPM));
    const contentHash = hashContent(Buffer.from(raw));
    const lastMod = getGitLastModified(full);
    const postMeta = { slug, title, date, excerpt, tags, pathRel: rel, wordCount, readingTimeMin, hash: contentHash, draft: isDraft, lastMod };
    if (isAbout) aboutNote = { ...postMeta, content }; else posts.push({ ...postMeta, content });
  });
  posts.sort((a,b)=> b.date.localeCompare(a.date));
  return { posts, aboutNote };
}

/* ---------- Critical CSS Extraction (heuristic) ---------- */
function extractCritical(fullCss){
  const blocks = fullCss.split(/}\s*/).map(b=>b+'}');
  const keep = [];
  for (const blk of blocks){
    if (CONFIG.criticalSelectors.some(sel => blk.includes(sel))) keep.push(blk); }
  let crit = keep.join('\n');
  crit = crit.replace(/\n+/g,'\n');
  return crit;
}

/* ---------- Image Optimization ---------- */
// Replace static sharp import with lazy loader
let sharpLib = null;
async function getSharp(){
  if (sharpLib) return sharpLib;
  try { sharpLib = (await import('sharp')).default; }
  catch { console.warn('[img] sharp not installed, skipping WebP optimization'); sharpLib = null; }
  return sharpLib;
}
const IMAGE_VARIANT_WIDTHS = [400, 800, 1200];
async function optimizeImages(){
  const sharp = await getSharp();
  if (!sharp) return { list: [], map: {} };
  const imgFiles = fg.sync(['**/*.{png,jpg,jpeg}'], { cwd: PUBLIC_DIR, dot:false }).map(f=>({ from: path.join(PUBLIC_DIR,f), rel: f }));
  const noteImgs = fg.sync(['**/*.{png,jpg,jpeg}'], { cwd: NOTES_DIR, ignore:['attachments/**'] }).map(f=>({ from: path.join(NOTES_DIR,f), rel: path.join('notes',f).replace(/\\/g,'/') }));
  const all = [...imgFiles, ...noteImgs];
  const results = []; const map = {};
  await Promise.all(all.map(async f => {
    try {
      const buf = fs.readFileSync(f.from);
      const meta = await sharp(f.from).metadata();
      const origHash = hashContent(buf);
      const outDir = path.join(DIST, path.dirname(f.rel)); ensureDir(outDir);
      const baseName = path.basename(f.rel).replace(/\.(png|jpe?g)$/i,'');
      const possibleWidths = IMAGE_VARIANT_WIDTHS.filter(w=> !meta.width || w <= meta.width).length? IMAGE_VARIANT_WIDTHS.filter(w=> !meta.width || w <= meta.width): [meta.width];
      const variants = [];
      for (const w of possibleWidths){
        const resize = meta.width && w < meta.width;
        const outBase = `${baseName}.${w}.${origHash}.webp`;
        const outAbs = path.join(outDir, outBase);
        if (!fs.existsSync(outAbs)){
          let inst = sharp(f.from);
            if (resize) inst = inst.resize({ width:w });
            await inst.webp({ quality:82 }).toFile(outAbs);
        }
        variants.push({ w, path: path.relative(DIST,outAbs).replace(/\\/g,'/'), width: resize? w: meta.width, height: meta.height ? Math.round(meta.height * ( (resize? w: meta.width)/meta.width )): undefined });
      }
      variants.sort((a,b)=> a.w - b.w);
      results.push({ rel: f.rel, hash: origHash, variants });
      map[f.rel] = { variants };
    } catch(e){ console.warn('[img] optimize failed for', f.rel, e.message); }
  }));
  return { list: results, map };
}

/* ---------- Asset Fingerprinting & Minification ---------- */
function processAssets(){
  // CSS
  const cssPath = path.join(CSS_DIR, 'style.css');
  const cssRaw = fs.readFileSync(cssPath,'utf8');
  const critical = extractCritical(cssRaw);
  const minCss = csso.minify(cssRaw).css;
  const cssHash = hashContent(minCss);
  const cssOutRel = `css/style.${cssHash}.css`;
  write(path.join(DIST, cssOutRel), minCss);
  // JS: starfield + enhancements (built later)
  const starSrc = path.join(JS_DIR,'starfield.js');
  const enhSrc = path.join(__root,'src','enhancements.js');
  const jsOutputs = esbuild.buildSync({ entryPoints: [starSrc, enhSrc], outdir: path.join(DIST,'js'), format:'iife', bundle:false, minify:true, sourcemap:false, splitting:false, write:false });
  const assetMap = {};
  jsOutputs.outputFiles.forEach(of => {
    const fname = path.basename(of.path);
    const h = hashContent(of.text);
    const newName = fname.replace(/\.js$/, `.${h}.js`);
    const rel = 'js/'+newName;
    write(path.join(DIST, rel), of.text);
    assetMap[fname] = rel;
  });
  return { css: { file: cssOutRel, critical }, js: assetMap };
}

/* ---------- RSS Feed (RSS 2.0) ---------- */
function buildRSS(posts){
  const site = SITE_ORIGIN || '';
  const rssItems = posts.filter(p=>!p.draft).map(p => { // exclude drafts
    const url = site + SITE_BASE + `/blog/${p.slug}/`;
    const contentHTML = renderMarkdownWithExtrasSync(p.content);
    return `<item>\n<title>${escapeXml(p.title)}</title>\n<link>${escapeXml(url)}</link>\n<guid>${escapeXml(url)}</guid>\n<pubDate>${new Date(p.date).toUTCString()}</pubDate>\n<description><![CDATA[${contentHTML}]]></description>\n</item>`; }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n<title>${escapeXml(CONFIG.rss.title)}</title>\n<link>${escapeXml(site + SITE_BASE + '/')}</link>\n<description>${escapeXml(CONFIG.rss.description)}</description>\n<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n${rssItems}\n</channel>\n</rss>`;
}

function buildTagRSS(tag, posts){
  const site = SITE_ORIGIN || '';
  const rssItems = posts.filter(p=>!p.draft).map(p=>{ const url = site + SITE_BASE + `/blog/${p.slug}/`; const contentHTML = renderMarkdownWithExtrasSync(p.content); return `<item>\n<title>${escapeXml(p.title)}</title>\n<link>${escapeXml(url)}</link>\n<guid>${escapeXml(url)}</guid>\n<pubDate>${new Date(p.date).toUTCString()}</pubDate>\n<description><![CDATA[${contentHTML}]]></description>\n</item>`; }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n<title>${escapeXml(tag)} — ${escapeXml(CONFIG.rss.title)}</title>\n<link>${escapeXml(site + SITE_BASE + '/tags/'+sanitizeSlug(tag)+'/')}</link>\n<description>Posts tagged ${escapeXml(tag)}</description>\n<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n${rssItems}\n</channel>\n</rss>`;
}

/* ---------- Simple Broken Link Checker ---------- */
function checkBrokenLinks(){
  const htmlFiles = fg.sync('**/*.html', { cwd: DIST });
  const missing = [];
  const exists = p => fs.existsSync(path.join(DIST,p.replace(/^\//,'')));
  htmlFiles.forEach(f => {
    const full = fs.readFileSync(path.join(DIST,f),'utf8');
    const links = [...full.matchAll(/href=\"(.*?)\"/g)].map(m=>m[1])
      .filter(h=> h.startsWith(SITE_BASE+'/') || h.startsWith('/') );
    links.forEach(l => {
      let rel = l.replace(SITE_BASE,'');
      if (rel.endsWith('/')) rel = rel + 'index.html';
      if (rel.startsWith('/')) rel = rel.slice(1);
      if (!exists(rel)) missing.push({ from:f, link:l });
    });
  });
  if (missing.length){
    console.warn('Broken links detected:');
    missing.slice(0,30).forEach(m=>console.warn('  ',m.from,'->',m.link));
  }
  return missing;
}

/* ---------- Layout Helper (dynamic meta) ---------- */
import layout from './src/templates/layout.js';
import { nav } from './src/templates/component.js';

/* ---------- Build Steps ---------- */
async function buildSite(){
  if (!_cachedHighlighter){
    try { _cachedHighlighter = await ensureHighlighter(); } catch(e){ console.warn('[shiki] highlighter init failed:', e.message); }
  }
  console.log('• Building site...');
  const t0 = Date.now();
  const prevManifest = fs.existsSync(MANIFEST_FILE) ? JSON.parse(fs.readFileSync(MANIFEST_FILE,'utf8')) : null;
  const incremental = !!prevManifest;
  const siteVersion = computeSiteVersion();
  const siteChanged = prevManifest && prevManifest.siteVersion !== siteVersion;
  if (!incremental) { fs.rmSync(DIST, { recursive:true, force:true }); }
  ensureDir(DIST);
  copyTree(PUBLIC_DIR, DIST);
  copyTree(JS_DIR, path.join(DIST,'js'));
  copyTree(path.join(NOTES_DIR, 'attachments'), path.join(DIST,'attachments'));
  const { posts, aboutNote } = collectNotes();
  const imagesResultPromise = optimizeImages();
  const assets = processAssets();
  posts.forEach(p => { if (!p.title) console.warn('[warn] missing title for', p.slug); if (!p.date) console.warn('[warn] missing date for', p.slug); });
  write(path.join(DIST,'content','posts.json'), JSON.stringify(posts.map(p => ({ slug:p.slug, title:p.title, date:p.date, excerpt:p.excerpt, tags:p.tags, readingTimeMin:p.readingTimeMin, wordCount:p.wordCount, draft: p.draft, pathRel: p.pathRel })), null, 2));
  const totalWords = posts.reduce((a,b)=>a+b.wordCount,0);
  const avgWords = posts.length? Math.round(totalWords/posts.length):0;
  const homeList = `<ul class="home-links"><li><a href="${SITE_BASE}/about/"><span class="arrow">›</span> About Me</a></li><li><a href="${SITE_BASE}/blog/"><span class="arrow">›</span> Blog</a></li></ul>`;
  write(path.join(DIST,'index.html'), layout({ title:'home', active:'/home/', body:homeList, base:SITE_BASE, assets, meta:{ description:'home', type:'website' }, headingOverride:'himu.me' }));
  let aboutHTML = aboutNote ? `<article class="markdown">${renderMarkdownWithExtrasSync(aboutNote.content)}</article>` : `<article class="markdown"><h1>About</h1><p>Add an <code>about.md</code> to populate this page.</p></article>`;
  // Inject resume link if missing
  if (!/Himanshu_Tiwari_Resume\.pdf/.test(aboutHTML)) { aboutHTML = `<p><a href="${SITE_BASE}/Himanshu_Tiwari_Resume.pdf">View Resume</a></p>` + aboutHTML; }
  // Transform "Bubbles of Me" section: convert bold pipe-separated list into bubble elements
  try {
    aboutHTML = aboutHTML.replace(/(<h2[^>]*>Bubbles of Me<\/h2>)([\s\S]*?)(<h2|<\/article>)/, (m, h2, mid, tailStart) => {
      const bubbleParaMatch = mid.match(/<p><strong>([\s\S]*?)<\/strong><\/p>/);
      if (!bubbleParaMatch) return m; // no change
      const items = bubbleParaMatch[1].split('|').map(s=>s.trim()).filter(Boolean);
      const bubbles = `<div class="bubbles">${items.map(it=>`<span class=\"bubble\">${escapeHtml(it)}</span>`).join('')}</div>`;
      const midUpdated = mid.replace(bubbleParaMatch[0], bubbles);
      return h2 + midUpdated + tailStart;
    });
  } catch {}
  write(path.join(DIST,'about','index.html'), layout({ title:'about', active:'/about/', body:aboutHTML + `<nav class="post-nav"><a href="${SITE_BASE}/">&larr; Back to Home</a></nav>`, base:SITE_BASE, assets, meta:{ description:'about', type:'profile' } }));
  const blogList = `<ul class="post-list">${posts.map(p => `<li><a href="${SITE_BASE}/blog/${p.slug}/"><span class="arrow">›</span> ${p.date} - ${p.title}</a></li>`).join('')}</ul>`;
  write(path.join(DIST,'blog','index.html'), layout({ title:'blog', active:'/blog/', body:blogList, base:SITE_BASE, assets, meta:{ description:'blog posts', type:'website' } }));
  // RSS page (pretty UI page linking to raw feed)
  const rssPage = `<h1>RSS</h1><p>Subscribe via <code>${SITE_BASE}/feed.xml</code></p><p><a href="${SITE_BASE}/feed.xml">Raw feed</a></p>`;
  write(path.join(DIST,'rss','index.html'), layout({ title:'rss', active:'/rss/', body:rssPage, base:SITE_BASE, assets, meta:{ description:'rss feed', type:'website' } }));
  const tagSet = new Map();
  posts.forEach(p => p.tags.forEach(t => { if (!tagSet.has(t)) tagSet.set(t, []); tagSet.get(t).push(p); }));
  const tagIndex = `<h2>Tags</h2><ul class="post-list">${[...tagSet.keys()].sort().map(t => `<li><a href="${SITE_BASE}/tags/${sanitizeSlug(t)}/">${t} (${tagSet.get(t).length})</a></li>`).join('')}</ul>`;
  write(path.join(DIST,'tags','index.html'), layout({ title:'tags', active:'/tags/', body:tagIndex, base:SITE_BASE, assets, meta:{ description:'tags', type:'website' } }));
  tagSet.forEach((postsArr, tag) => { /* existing gen */ const body = `<h2>Tag: ${escapeHtml(tag)}</h2><ul class="post-list">${postsArr.map(p => `<li><a href="${SITE_BASE}/blog/${p.slug}/"><span class=\"arrow\">›</span> ${p.date} - ${p.title}</a></li>`).join('')}</ul><p><a href="${SITE_BASE}/tags/${sanitizeSlug(tag)}/feed.xml" class="rss-mini">Tag RSS</a></p>`; write(path.join(DIST,'tags',sanitizeSlug(tag),'index.html'), layout({ title:`tag-${tag}`, active:'/tags/', body, base:SITE_BASE, assets, meta:{ description:`Tag ${tag}`, type:'website' } })); write(path.join(DIST,'tags',sanitizeSlug(tag),'feed.xml'), buildTagRSS(tag, postsArr)); });
  posts.forEach(p => {
    const prevNotes = prevManifest?.notes || {};
    const unchanged = incremental && prevNotes[p.slug] === p.hash && !siteChanged;
    const htmlRaw = renderMarkdownWithExtrasSync(p.content);
    // Strip leading H1 always
    let html = htmlRaw.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/i, '');
    // Table of contents with fallback for missing ids
    const headingMatches = [];
    html = html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g, (m, level, attrs, inner) => {
      const textPlain = inner.replace(/<[^>]+>/g,'').trim();
      let idMatch = attrs.match(/id="([^"]+)"/);
      let id = idMatch ? idMatch[1] : sanitizeSlug(textPlain).slice(0,64);
      headingMatches.push({ level, id, text: textPlain });
      if (idMatch) return m; // already has id
      const newAttrs = attrs + ` id="${id}"`;
      return `<h${level}${newAttrs}>${inner}</h${level}>`;
    });
    // Build hierarchical TOC structure (h2 + nested h3) -> breadcrumb arrow styled
    const filtered = headingMatches.filter(h=> h.level==='2' || h.level==='3');
    let tocHtml='';
    if (filtered.length>=2){
      const groups=[]; let current=null;
      filtered.forEach(h=>{ if(h.level==='2'){ current={ h, children:[] }; groups.push(current); } else if (h.level==='3' && current){ current.children.push(h); } });
      tocHtml = `<nav class="toc" style="color:var(--link)"><ul class="toc-list">` + groups.map(g=>{
        const childHtml = g.children.length? `<ul class="toc-sub">${g.children.map(c=> `<li class="toc-item toc-lvl3" style="color:var(--link)"><a href="#${c.id}" style="color:var(--link)">${c.text}</a></li>`).join('')}</ul>`: '';
        return `<li class="toc-item toc-lvl2" style="color:var(--link)"><a href="#${g.h.id}" style="color:var(--link)">${g.h.text}</a>${childHtml}</li>`;
      }).join('') + '</ul></nav>';
    }
    const schema = { '@context':'https://schema.org', '@type':'Article', headline:p.title, datePublished:p.date, dateModified: p.lastMod || p.date, wordCount:p.wordCount, author:{ '@type':'Person', name:'himu' } };
    const ogRelPromise = ensureOgImage(p.slug, p.title);
    p._ogPromise = ogRelPromise;
    const metaLine = `<div class="post-meta">${p.date} • ${p.readingTimeMin} min • ${p.wordCount} words${p.lastMod && p.lastMod.slice(0,10)!==p.date ? ' • updated '+p.lastMod.slice(0,10):''}${p.draft && DRAFTS ? ' • draft':''}</div>`;
    const watermark = p.draft && DRAFTS ? '<div class="draft-watermark">DRAFT</div>' : '';
    const body = `${watermark}${metaLine}${tocHtml}<article class="markdown">${html}</article><nav class="post-nav"><a href="${SITE_BASE}/blog/">&larr; Back to Blog</a></nav>`;
    if (!(unchanged && fs.existsSync(path.join(DIST,'blog',p.slug,'index.html'))))
      write(path.join(DIST,'blog',p.slug,'index.html'), layout({ title:p.title, active:'/blog/', body, base:SITE_BASE, assets, headingOverride:p.title, meta:{ description:p.excerpt, type:'article', date:p.date, schema, ogPending:true, post:true }, }));
  });
  write(path.join(DIST,'feed.xml'), buildRSS(posts));
  write(path.join(DIST,'404.html'), layout({ title:'404', active:'', body:`<h1>404</h1><p>Page not found.</p>`, base:SITE_BASE, assets, meta:{ description:'not found', type:'website' } }));
  if (SITE_ORIGIN){ const urls = [SITE_BASE+'/', SITE_BASE+'/about/', SITE_BASE+'/blog/', ...posts.map(p=> SITE_BASE+`/blog/${p.slug}/`), SITE_BASE+'/tags/', ...[...tagSet.keys()].map(t=> SITE_ORIGIN+`/tags/${sanitizeSlug(t)}/`)]; const sm = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${SITE_ORIGIN}${u}</loc></url>`).join('')}</urlset>`; write(path.join(DIST,'sitemap.xml'), sm); }
  return imagesResultPromise.then(async imagesResult => {
    const imagesMap = imagesResult.map; // rewrite images in posts + about
    // Patch posts with responsive images
    for (const p of posts){
      const file = path.join(DIST,'blog',p.slug,'index.html');
      if (fs.existsSync(file)){
        const orig = fs.readFileSync(file,'utf8');
        const updated = orig.replace(/<article class="markdown">([\s\S]*?)<\/article>/, (m, inner)=> `<article class="markdown">${rewriteImages(inner, imagesMap, SITE_BASE)}</article>`);
        if (updated !== orig) fs.writeFileSync(file, updated); // only write if changed
      }
    }
    const aboutFile = path.join(DIST,'about','index.html');
    if (fs.existsSync(aboutFile)){
      const orig = fs.readFileSync(aboutFile,'utf8');
      const updated = orig.replace(/<article class="markdown">([\s\S]*?)<\/article>/, (m, inner)=> `<article class="markdown">${rewriteImages(inner, imagesMap, SITE_BASE)}</article>`);
      if (updated !== orig) fs.writeFileSync(aboutFile, updated);
    }
    await Promise.all(posts.map(async p => { const ogPath = await p._ogPromise; const file = path.join(DIST,'blog',p.slug,'index.html'); if (fs.existsSync(file)){ let html = fs.readFileSync(file,'utf8'); if (!html.includes('property="og:image"')) { const ogAbs = (SITE_ORIGIN? SITE_ORIGIN: '') + SITE_BASE + '/' + ogPath; html = html.replace('</head>','<meta property="og:image" content="'+ogAbs+'"><meta name="twitter:image" content="'+ogAbs+'"></head>'); fs.writeFileSync(file, html); } } }));
    // JSON feed
    write(path.join(DIST,'feed.json'), await buildJSONFeed(posts));
    // Atom per-tag
    const tagSet = new Map(); posts.forEach(p=> p.tags.forEach(t=>{ if(!tagSet.has(t)) tagSet.set(t, []); tagSet.get(t).push(p); }));
    tagSet.forEach((arr, tag)=> { write(path.join(DIST,'tags',sanitizeSlug(tag),'feed.atom'), buildAtomFeed(tag, arr)); });
    const missing = checkBrokenLinks();
    if (STRICT_LINKS && missing.length){
      console.error(`✖ Broken links (${missing.length}) — failing build due to strict mode.`);
      process.exitCode = 2;
    }
    const noteHashes = {}; posts.forEach(p => { noteHashes[p.slug]=p.hash; });
    write(MANIFEST_FILE, JSON.stringify({ generated: Date.now(), notes: noteHashes, siteVersion }, null, 2));
    const dt = Date.now()-t0; console.log(`✔ Build complete${incremental?' (incremental)':''}: ${posts.length} posts, ${imagesResult.list.length} images optimized, avg words ${avgWords} in ${dt}ms`);
  });
}

const SITE_FILES = [path.join(__root,'build.mjs'), path.join(__root,'src','templates','layout.js'), path.join(__root,'src','templates','component.js')];
function computeSiteVersion(){
  let acc = '';
  for (const f of SITE_FILES){ try { acc += fs.readFileSync(f); } catch {} }
  return hashContent(Buffer.from(acc));
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c])); }
function escapeXml(s){ return s.replace(/[<>&]/g,c=>({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c])); }

/* ---------- Add missing helpers ---------- */
function getGitLastModified(filePath){
  try {
    const r = spawnSync('git', ['log','-1','--format=%cI', filePath], { encoding:'utf8' });
    if (r.status === 0) {
      const out = r.stdout.trim();
      if (out) return out;
    }
  } catch {}
  try { return fs.statSync(filePath).mtime.toISOString(); } catch { return null; }
}

async function ensureOgImage(slug, title){
  // First check if pre-generated in public/og
  const publicOgDir = path.join(PUBLIC_DIR,'og');
  const publicPng = path.join(publicOgDir, slug + '.png');
  if (fs.existsSync(publicPng)) return 'og/' + slug + '.png';
  const publicSvg = path.join(publicOgDir, slug + '.svg');
  if (fs.existsSync(publicSvg)) return 'og/' + slug + '.svg';
  const ogDir = path.join(DIST,'og'); ensureDir(ogDir);
  const pngPath = path.join(ogDir, slug + '.png');
  if (fs.existsSync(pngPath)) return 'og/' + slug + '.png';
  const safeTitle = escapeHtml(title).replace(/&/g,'&amp;');
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2a1240"/><stop offset="1" stop-color="#170d28"/></linearGradient></defs><rect fill="url(#g)" width="1200" height="630"/><text x="60" y="300" font-family="'IBM Plex Mono', monospace" font-size="64" fill="#d665ff">${safeTitle}</text><text x="60" y="380" font-family="'IBM Plex Mono', monospace" font-size="28" fill="#8891a8">himu.me</text></svg>`;
  try {
    const sharp = await getSharp();
    if (sharp) {
      await sharp(Buffer.from(svg)).png().toFile(pngPath);
      return 'og/' + slug + '.png';
    }
  } catch {}
  const svgPath = path.join(ogDir, slug + '.svg');
  fs.writeFileSync(svgPath, svg);
  return 'og/' + slug + '.svg';
}

// Responsive image HTML rewrite
function rewriteImages(html, imagesMap, base){
  return html.replace(/<img\s+([^>]*?)src="([^"]+)"([^>]*)>/g, (m, pre, src, post) => {
    if (/^(https?:|data:)/.test(src)) return m; // external or data URI untouched
    let entry = imagesMap[src] || imagesMap[src.replace(/^\/?/, '')];
    if (!entry){
      // Fallback: find unique candidate whose key ends with '/' + src (relative image reference)
      const candidates = Object.keys(imagesMap).filter(k => k.endsWith('/'+src));
      if (candidates.length === 1) entry = imagesMap[candidates[0]]; else return m;
    }
    const variants = entry.variants;
    if (!variants || !variants.length) return m;
    const altMatch = m.match(/alt="([^"]*)"/); const alt = altMatch? altMatch[1]: '';
    const srcset = variants.map(v=> `${base}/${v.path} ${v.w}w`).join(', ');
    const largest = variants[variants.length-1];
    const sizes = '(max-width: 900px) 100vw, 900px';
    const widthAttr = largest.width ? ` width="${largest.width}"` : '';
    const heightAttr = largest.height ? ` height="${largest.height}"` : '';
    return `<picture><source type="image/webp" srcset="${srcset}" sizes="${sizes}"><img src="${base}/${largest.path}"${widthAttr}${heightAttr} alt="${alt}" loading="lazy" decoding="async"></picture>`;
  });
}
// JSON Feed builder
async function buildJSONFeed(posts){
  const site = SITE_ORIGIN || '';
  const feed = { version: 'https://jsonfeed.org/version/1', title: CONFIG.rss.title, home_page_url: site + SITE_BASE + '/', feed_url: site + SITE_BASE + '/feed.json', description: CONFIG.rss.description, items: posts.filter(p=>!p.draft).map(p => { const url = site + SITE_BASE + `/blog/${p.slug}/`; return { id:url, url, title: p.title, content_html: renderMarkdownWithExtrasSync(p.content), date_published: new Date(p.date).toISOString(), tags: p.tags }; }) };
  return JSON.stringify(feed, null, 2);
}
// Per-tag Atom feed (simple)
function buildAtomFeed(tag, posts){
  const site = SITE_ORIGIN || '';
  const updated = new Date().toISOString();
  const entries = posts.filter(p=>!p.draft).map(p => { const url = site + SITE_BASE + `/blog/${p.slug}/`; return `<entry><id>${escapeXml(url)}</id><title>${escapeXml(p.title)}</title><link href="${escapeXml(url)}"/><updated>${new Date(p.date).toISOString()}</updated><content type="html"><![CDATA[${renderMarkdownWithExtrasSync(p.content)}]]></content></entry>`; }).join('');
  return `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${escapeXml(tag)} — ${escapeXml(CONFIG.rss.title)}</title><updated>${updated}</updated>${entries}</feed>`;
}

/* ---------- Run Build ---------- */
buildSite().catch(e => { console.error(e); process.exit(1); });

/* ---------- Watch / Serve ---------- */
if (WATCH){
  chokidar.watch([NOTES_DIR, CSS_DIR, JS_DIR, PUBLIC_DIR], { ignoreInitial:true }).on('all', (evt, file) => {
    console.log(`↻ Change (${evt}): ${path.relative(__root, file)}`);
    buildSite().catch(err => console.error('Build error', err));
  });
}
if (SERVE){
  const serve = serveStatic(DIST, { setHeaders(res,p){ const type = mime.getType(p); if (type) res.setHeader('Content-Type', type); res.setHeader('Cache-Control','no-cache'); } });
  const port = 4321;
  http.createServer((req,res) => { serve(req,res, finalhandler(req,res)); }).listen(port, () => console.log(`• Dev server: http://localhost:${port}${SITE_BASE||''}`));
}

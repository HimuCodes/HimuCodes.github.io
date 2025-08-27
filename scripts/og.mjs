#!/usr/bin/env node
/**
 * Generate Open Graph images for all posts (excluding drafts unless --drafts)
 * Places output in public/og/<slug>.png (or .svg fallback if sharp missing)
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import slugify from 'slugify';

const ROOT = process.cwd();
const NOTES = path.join(ROOT,'notes');
const OUT = path.join(ROOT,'public','og');
const INCLUDE_DRAFTS = process.argv.includes('--drafts');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive:true });

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.warn('[og] sharp not installed, will write svg fallbacks'); }

function sanitizeSlug(s){ return slugify(s, { lower:true, strict:true, remove: /[*+~.()'"!:@?]/g }); }

const files = (function list(dir){ return fs.readdirSync(dir).flatMap(f=>{ const full=path.join(dir,f); if (fs.statSync(full).isDirectory()) return list(full); return f.endsWith('.md')? [full]: []; }); })(NOTES);
let count=0, skipped=0;
for (const file of files){
  const raw = fs.readFileSync(file,'utf8');
  const parsed = matter(raw);
  const fm = parsed.data || {};
  const rel = path.relative(NOTES,file).replace(/\\/g,'/');
  const base = path.basename(file).toLowerCase();
  if (base === 'about.md') { skipped++; continue; }
  if (fm.publish === false) { skipped++; continue; }
  if (fm.draft && !INCLUDE_DRAFTS) { skipped++; continue; }
  const title = fm.title || base.replace(/\.md$/,'');
  const slug = fm.slug ? sanitizeSlug(fm.slug) : sanitizeSlug(title);
  const png = path.join(OUT, slug + '.png');
  const svgPath = path.join(OUT, slug + '.svg');
  if (fs.existsSync(png) || fs.existsSync(svgPath)) { skipped++; continue; }
  const safeTitle = title.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2a1240"/><stop offset="1" stop-color="#170d28"/></linearGradient></defs><rect fill="url(#g)" width="1200" height="630"/><text x="60" y="300" font-family="'IBM Plex Mono', monospace" font-size="64" fill="#d665ff">${safeTitle}</text><text x="60" y="380" font-family="'IBM Plex Mono', monospace" font-size="28" fill="#8891a8">himu.me</text></svg>`;
  try {
    if (sharp){ await sharp(Buffer.from(svg)).png().toFile(png); count++; continue; }
  } catch (e){ console.warn('[og] sharp failed, falling back to svg for', slug, e.message); }
  fs.writeFileSync(svgPath, svg); count++;
}
console.log(`[og] Generated ${count} images (${skipped} skipped). Output: public/og/`);


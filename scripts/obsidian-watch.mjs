#!/usr/bin/env node
/**
 * Obsidian vault watcher -> local notes/posts sync + live build.
 * Fixed path mode: now ALWAYS uses the single specified folder path (no auto detection / flags).
 * Test overrides (non-production):
 *  - OBS_TEST_VAULT: alternate path for tests
 *  - OBS_SKIP_BUILD: skip spawning build process (tests)
 *  - OBS_NO_GIT: disable git add/commit (tests)
 */
import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import slugify from 'slugify';
import { spawn, execSync } from 'child_process';

const args = process.argv.slice(2);
const flag = n => args.includes(`--${n}`);

const TEST_OVERRIDE = process.env.OBS_TEST_VAULT;
const DISABLE_GIT = !!process.env.OBS_NO_GIT;
const SKIP_BUILD = !!process.env.OBS_SKIP_BUILD;

// Removed dynamic FULLPATH/VAULT/FOLDER detection. Hard-coded single path per user request unless explicit test override is set.
const vaultFolder = path.resolve(TEST_OVERRIDE || 'C:/Users/himan/OneDrive/Documents/Obsidian Vault/Blog');
if (!fs.existsSync(vaultFolder)) { console.error('Fixed watch path not found:', vaultFolder); process.exit(2); }

const RECURSIVE = flag('recursive');
const PUSH = flag('push');
const NO_DELETE = flag('no-delete');
const INCLUDE_DRAFTS = flag('drafts');
const INCLUDE_FUTURE = flag('future');

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT,'notes','posts');
fs.mkdirSync(POSTS_DIR, { recursive:true });

const slugifySafe = s => slugify(s, { lower:true, strict:true, remove: /[*+~.()'"!:@?]/g });

function parseFrontmatter(raw){
  if (!raw.startsWith('---\n')) return { fm:{}, body: raw };
  const end = raw.indexOf('\n---', 4);
  if (end === -1) return { fm:{}, body: raw };
  const block = raw.slice(4, end).trim();
  const body = raw.slice(end+4).replace(/^\r?\n/, '');
  const fm={};
  block.split(/\r?\n/).forEach(line=>{ const m=line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/); if(m){ let v=m[2].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); fm[m[1]]=v; }});
  return { fm, body };
}

function buildFrontmatter(fm){
  const order=['title','date','slug','draft','tags'];
  const lines=[];
  for (const k of order){ if(fm[k]===undefined||fm[k]==='') continue; if(Array.isArray(fm[k])) lines.push(`${k}: [${fm[k].map(v=>`'${v}'`).join(', ')}]`); else lines.push(`${k}: "${fm[k]}"`); }
  Object.keys(fm).filter(k=>!order.includes(k)).forEach(k=> lines.push(`${k}: ${fm[k]}`));
  return `---\n${lines.join('\n')}\n---\n\n`;
}

function ensureFrontmatter(raw, filename){
  const { fm, body } = parseFrontmatter(raw);
  if (!fm.title) fm.title = filename.replace(/\.md$/,'');
  if (!fm.date) fm.date = new Date().toISOString().slice(0,10);
  if (!fm.slug) fm.slug = slugifySafe(fm.title);
  return buildFrontmatter(fm) + body.replace(/\s+$/,'') + '\n';
}

function syncFile(src){
  try {
    if (!src.endsWith('.md')) return;
    const stat = fs.statSync(src); if (!stat.isFile()) return;
    const base = path.basename(src);
    if (base.startsWith('_') || base.startsWith('.')) return;
    const raw = fs.readFileSync(src,'utf8');
    const out = ensureFrontmatter(raw, base);
    const { fm } = parseFrontmatter(out);
    const dest = path.join(POSTS_DIR, fm.slug + '.md');
    if (!fs.existsSync(dest) || fs.readFileSync(dest,'utf8') !== out){
      fs.writeFileSync(dest, out);
      console.log('[obsidian-sync] updated:', path.relative(ROOT,dest));
      scheduleCommit();
    }
  } catch(e){ console.warn('[obsidian-sync] sync error', src, e.message); }
}

function removeFile(src){
  if (NO_DELETE) return;
  if (!src.endsWith('.md')) return;
  try {
    const raw = fs.existsSync(src)? fs.readFileSync(src,'utf8'): '';
    let slug;
    if (raw){ const { fm } = parseFrontmatter(raw); slug = fm.slug || slugifySafe(path.basename(src,'.md')); }
    else slug = slugifySafe(path.basename(src,'.md'));
    const dest = path.join(POSTS_DIR, slug + '.md');
    if (fs.existsSync(dest)) { fs.unlinkSync(dest); console.log('[obsidian-sync] removed:', path.relative(ROOT,dest)); scheduleCommit(); }
  } catch(e){ console.warn('[obsidian-sync] remove error', src, e.message); }
}

async function initialSync(){
  if (!RECURSIVE){
    fs.readdirSync(vaultFolder).filter(f=>f.endsWith('.md')).forEach(f=> syncFile(path.join(vaultFolder,f)));
  } else {
    const fg = (await import('fast-glob')).default;
    fg.sync('**/*.md', { cwd: vaultFolder, dot:false }).forEach(rel => syncFile(path.join(vaultFolder, rel)));
  }
}

let commitTimer=null; const COMMIT_DELAY=2000;
function scheduleCommit(){
  if (DISABLE_GIT) return; // test mode: skip git side-effects
  clearTimeout(commitTimer);
  if (!PUSH) {
    commitTimer = setTimeout(()=>{
      try {
        execSync('git add notes/posts', { stdio:'inherit' });
        const diff = execSync('git diff --cached --name-only').toString().trim();
        if (!diff){ return; }
        const msg = `[obsidian-sync] commit-only @ ${new Date().toISOString()}`;
        execSync(`git commit -m "${msg}"`, { stdio:'inherit' });
      } catch(e){ console.warn('[obsidian-sync] git commit failed:', e.message); }
    }, COMMIT_DELAY);
    return;
  }
  commitTimer = setTimeout(()=>{
    try {
      execSync('git add notes/posts', { stdio:'inherit' });
      const diff = execSync('git diff --cached --name-only').toString().trim();
      if (!diff){ console.log('[obsidian-sync] no git changes'); return; }
      const msg = `[obsidian-sync] update @ ${new Date().toISOString()}`;
      execSync(`git commit -m "${msg}"`, { stdio:'inherit' });
      execSync('git push', { stdio:'inherit' });
      console.log('[obsidian-sync] pushed changes');
    } catch(e){ console.warn('[obsidian-sync] git push failed:', e.message); }
  }, COMMIT_DELAY);
}

// Spawn build watcher unless skipped (tests)
let buildProc = null;
if (!SKIP_BUILD){
  const buildArgs=['build.mjs','--watch'];
  if (INCLUDE_DRAFTS) buildArgs.push('--drafts');
  if (INCLUDE_FUTURE) buildArgs.push('--future');
  buildProc = spawn('node', buildArgs, { stdio:'inherit' });
}

console.log('[obsidian-sync] Initial sync...');
await initialSync();
console.log('[obsidian-sync] Watching:', vaultFolder);

const watchGlob = RECURSIVE ? path.join(vaultFolder,'**','*.md') : path.join(vaultFolder,'*.md');
const watcher = chokidar.watch(watchGlob, { ignoreInitial:true });
watcher.on('add', syncFile).on('change', syncFile).on('unlink', removeFile);

process.on('SIGINT', ()=>{ console.log('\n[obsidian-sync] shutdown'); watcher.close(); if(buildProc) buildProc.kill(); if(commitTimer) clearTimeout(commitTimer); process.exit(0); });

#!/usr/bin/env node
/**
 * Auto sync script: watches notes/ and public/og for changes, rebuilds (via separate build watcher) AND commits + pushes note changes.
 */
import chokidar from 'chokidar';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const NOTES = path.join(ROOT, 'notes');
const OG = path.join(ROOT, 'public', 'og');
if (!fs.existsSync(OG)) fs.mkdirSync(OG, { recursive:true });

// Start build watcher (includes drafts & future posts)
const buildProc = spawn('node', ['build.mjs', '--watch', '--drafts', '--future'], { stdio: 'inherit' });

let pending = false; let lastCommit = 0; const DEBOUNCE = 2500; // ms
function commitPush(reason){
  if (pending) return;
  pending = true;
  const now = Date.now();
  const since = now - lastCommit;
  const wait = since < DEBOUNCE ? DEBOUNCE - since : 0;
  setTimeout(()=>{
    lastCommit = Date.now();
    pending = false;
    const msg = `[auto-sync] ${reason} @ ${new Date().toISOString()}`;
    try {
      execSync('git add notes public/og', { stdio:'inherit' });
      const diff = execSync('git diff --cached --name-only').toString().trim();
      if (!diff) { console.log('[auto-sync] No changes to commit'); return; }
      execSync(`git commit -m "${msg}"`, { stdio:'inherit' });
      execSync('git push', { stdio:'inherit' });
      console.log('[auto-sync] Pushed changes');
    } catch (e){ console.warn('[auto-sync] git operation failed:', e.message); }
  }, wait);
}

const watcher = chokidar.watch([NOTES, OG], { ignoreInitial:true });
watcher.on('all', (evt, file) => {
  console.log(`[auto-sync] ${evt}: ${path.relative(ROOT,file)}`);
  commitPush(evt);
});

process.on('SIGINT', () => { console.log('\n[auto-sync] shutting down'); watcher.close(); buildProc.kill(); process.exit(0); });

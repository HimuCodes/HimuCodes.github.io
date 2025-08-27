#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { spawn } from 'child_process';

const root = process.cwd();

// Unique temp vault inside project (won't interfere with real fixed path)
const tempVault = path.join(root, '.tmp', 'obsidian-vault-test');
fs.mkdirSync(tempVault, { recursive:true });

// Source note (no frontmatter) -> should gain frontmatter + slug on sync
const srcName = 'watch-temp-unique-12345.md';
const srcPath = path.join(tempVault, srcName);
fs.writeFileSync(srcPath, 'Watch Temp Unique 12345\n\nBody line.');

// Expected slug (matches slugifySafe logic in watcher: lower, strict, remove punctuation)
const expectedSlug = 'watch-temp-unique-12345';
const destPath = path.join(root,'notes','posts', expectedSlug + '.md');
if (fs.existsSync(destPath)) fs.unlinkSync(destPath);

function waitFor(predicate, timeoutMs=15000, interval=100){
  return new Promise((resolve, reject)=>{
    const start = Date.now();
    const timer = setInterval(()=>{
      try {
        if (predicate()) { clearInterval(timer); resolve(); }
        else if (Date.now() - start > timeoutMs){ clearInterval(timer); reject(new Error('waitFor timeout')); }
      } catch(e){ clearInterval(timer); reject(e); }
    }, interval);
  });
}

// Spawn watcher directly via node (avoid npm indirection issues on Windows CI)
const watcherProc = spawn(process.execPath, ['scripts/obsidian-watch.mjs'], {
  cwd: root,
  env: { ...process.env,
    OBS_TEST_VAULT: tempVault,
    OBS_SKIP_BUILD: '1',
    OBS_NO_GIT: '1'
  },
  stdio: ['ignore','pipe','pipe']
});

let stdoutBuf = '';
let stderrBuf = '';
watcherProc.stdout.on('data', d=>{ stdoutBuf += d.toString(); });
watcherProc.stderr.on('data', d=>{ stderrBuf += d.toString(); });

(async ()=>{
  try {
    // 1. Initial sync creates file with frontmatter
    await waitFor(()=> fs.existsSync(destPath));
    const initial = fs.readFileSync(destPath,'utf8');
    assert.ok(/^---/m.test(initial), 'Frontmatter not added');
    assert.ok(/slug: "watch-temp-unique-12345"/.test(initial), 'Slug missing in frontmatter');

    // 2. Modify source -> dest updates
    fs.appendFileSync(srcPath, '\nAppended line.');
    await waitFor(()=> fs.readFileSync(destPath,'utf8').includes('Appended line.'));

    // 3. Delete source -> dest removed
    fs.unlinkSync(srcPath);
    await waitFor(()=> !fs.existsSync(destPath));

    // Gracefully stop watcher
    watcherProc.kill('SIGINT');
    await new Promise(res=> watcherProc.on('exit', res));

    // Basic stdout assertions
    assert.ok(/Initial sync/.test(stdoutBuf), 'Did not log initial sync');
    assert.ok(/Watching:/.test(stdoutBuf), 'Did not log watching path');

    // Cleanup temp vault
    fs.rmSync(tempVault, { recursive:true, force:true });

    console.log('Obsidian watch tests passed.');
  } catch (e){
    console.error('Obsidian watch test failed:', e.message);
    console.error('STDOUT:\n', stdoutBuf);
    console.error('STDERR:\n', stderrBuf);
    watcherProc.kill('SIGINT');
    process.exit(1);
  }
})();

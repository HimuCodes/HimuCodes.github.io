#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { execSync } from 'child_process';

const root = process.cwd();
const dist = path.join(root,'dist');

// Clean previous dist to avoid stale incremental artifacts impacting assertions (e.g., Shiki output)
if (fs.existsSync(dist)) {
  fs.rmSync(dist, { recursive:true, force:true });
}

function run(cmd, env={}){
  execSync(cmd, { stdio:'inherit', env: { ...process.env, ...env } });
}

function readJSON(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }

// Helper: ensure minimal sample image exists (1x1 png)
function ensureSampleImage(){
  const imgPath = path.join(root,'public','test-sample.png');
  if (!fs.existsSync(path.dirname(imgPath))) fs.mkdirSync(path.dirname(imgPath), { recursive:true });
  if (!fs.existsSync(imgPath)){
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='; // 1x1 transparent png
    fs.writeFileSync(imgPath, Buffer.from(b64,'base64'));
  }
}

// 1. Prepare draft note for test
const draftNote = path.join(root,'notes','__draft-test.md');
fs.writeFileSync(draftNote, `---\ntitle: Draft Test\ndate: 2025-08-01\npublish: true\ndraft: true\n---\n# Draft\nHidden.`);

// 1b. Multi-heading + image post (for TOC, responsive image, Shiki highlight)
ensureSampleImage();
const multiPost = path.join(root,'notes','posts','__multi-test.md');
fs.writeFileSync(multiPost, `---\ntitle: Multi Feature Test\ndate: 2025-08-02\ntags: ['multi','ci']\n---\n# Multi Feature Test\n\nIntro paragraph.\n\n## Section One\nSome text.\n\n### Subsection A\nMore text.\n\n## Section Two\nCode sample:\n\n\`\`\`js\nconsole.log('hi');\n\`\`\`\n\nImage below:\n\n![Alt text](/test-sample.png)\n`);

// 1c. Footnote demo post
const footnoteNote = path.join(root,'notes','posts','__footnote-demo.md');
fs.writeFileSync(footnoteNote, `---\ntitle: Footnote Demo\ndate: 2025-08-03\n---\n# Footnote Demo\n\nSome text with a footnote[^a] and second[^b].\n\n[^a]: First footnote\n[^b]: Second footnote\n`);

// 2. Initial build (exclude draft)
run('node build.mjs');

// 3. Assertions after first build
assert.ok(fs.existsSync(path.join(dist,'about','index.html')), 'about page missing');
assert.ok(fs.existsSync(path.join(dist,'blog','index.html')), 'blog index missing');
const postsJson = readJSON(path.join(dist,'content','posts.json'));
assert.ok(Array.isArray(postsJson) && postsJson.length > 0, 'posts.json empty');
postsJson.forEach(p => { assert.ok(p.readingTimeMin >= 1, 'reading time missing'); assert.ok(p.wordCount > 0, 'wordCount missing'); });
assert.ok(!postsJson.find(p=>p.slug === 'draft-test'), 'draft appeared in posts.json');
const feed = fs.readFileSync(path.join(dist,'feed.xml'),'utf8');
assert.ok(!feed.includes('<title>Draft Test</title>'), 'draft appeared in RSS');

// 3b. JSON Feed
assert.ok(fs.existsSync(path.join(dist,'feed.json')), 'feed.json missing');
const jsonFeed = readJSON(path.join(dist,'feed.json'));
assert.ok(jsonFeed.version && Array.isArray(jsonFeed.items) && jsonFeed.items.length>0, 'json feed invalid');

// 3c. Tag feeds (pick first tag if available)
const anyTag = postsJson.find(p=> p.tags && p.tags.length)?.tags[0];
if (anyTag){
  const tagSlug = anyTag.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  assert.ok(fs.existsSync(path.join(dist,'tags',tagSlug,'feed.xml')), 'tag rss missing');
  assert.ok(fs.existsSync(path.join(dist,'tags',tagSlug,'feed.atom')), 'tag atom missing');
}

// 3d. Multi-feature post checks
const multiSlug = 'multi-feature-test';
const multiHtmlPath = path.join(dist,'blog', multiSlug, 'index.html');
assert.ok(fs.existsSync(multiHtmlPath), 'multi-feature post missing');
const multiHtml = fs.readFileSync(multiHtmlPath,'utf8');
assert.ok(/<nav class="toc"/.test(multiHtml), 'TOC missing in multi-feature post');
assert.ok(/class="shiki/.test(multiHtml), 'Shiki highlighting missing');
assert.ok(/<picture>/.test(multiHtml), 'Responsive <picture> not injected for image');

// 3e. Footnotes rendering checks
const footSlug = 'footnote-demo';
const footHtmlPath = path.join(dist,'blog', footSlug, 'index.html');
assert.ok(fs.existsSync(footHtmlPath), 'footnote demo post missing');
const footHtml = fs.readFileSync(footHtmlPath,'utf8');
assert.ok(/<section class="footnotes">/.test(footHtml), 'footnotes section missing');
assert.ok(/id="fn-a"/.test(footHtml), 'footnote a list item missing');
assert.ok(/href="#fnref-a"/.test(footHtml), 'back reference link for footnote a missing');
assert.ok(/id="fnref-a"/.test(footHtml), 'footnote reference button id missing');

// 4. Incremental build test (no content change)
const somePost = postsJson[0];
const postHtmlPath = path.join(dist,'blog', somePost.slug, 'index.html');
const mtime1 = fs.statSync(postHtmlPath).mtimeMs;
run('node build.mjs');
const mtime2 = fs.statSync(postHtmlPath).mtimeMs;
assert.strictEqual(mtime1, mtime2, 'post regenerated unexpectedly without changes (incremental fail)');

// 5. Force content change and ensure regeneration
const targetNote = path.join(root,'notes', postsJson[0].slug + '.md');
if (fs.existsSync(targetNote)) {
  fs.appendFileSync(targetNote, '\nAppended line for incremental test.');
  run('node build.mjs');
  const mtime3 = fs.statSync(postHtmlPath).mtimeMs;
  assert.ok(mtime3 > mtime2, 'post did not regenerate after change');
}

// 6. New post script test
const newSlug = 'test-post-from-script';
const newPostFile = path.join(root,'notes','posts', newSlug + '.md');
if (fs.existsSync(newPostFile)) fs.unlinkSync(newPostFile);
run('node scripts/new-post.mjs "Test Post From Script" --tags=ci,test');
assert.ok(fs.existsSync(newPostFile), 'new-post script did not create file');
run('node build.mjs');
const postsJson2 = readJSON(path.join(dist,'content','posts.json'));
assert.ok(postsJson2.find(p=>p.slug===newSlug), 'new post missing from posts.json');

// 7. OG generation pre-build and reuse check
run('node scripts/og.mjs');
const ogPng = path.join(root,'public','og', newSlug + '.png');
const ogSvg = path.join(root,'public','og', newSlug + '.svg');
assert.ok(fs.existsSync(ogPng) || fs.existsSync(ogSvg), 'OG image not generated');

// 8. Strict link check (should pass)
run('node build.mjs --strict-links');

// Cleanup draft (keep generated posts & multi test for subsequent runs)
fs.unlinkSync(draftNote);

console.log('\nAll tests passed.');

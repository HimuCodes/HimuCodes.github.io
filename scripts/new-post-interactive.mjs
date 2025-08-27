#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import slugify from 'slugify';

function ask(rl, q){
  return new Promise(res => rl.question(q, ans => res(ans.trim())));
}

function makeSlug(title){
  return slugify(title, { lower:true, strict:true, remove: /[*+~.()'"!:@?]/g });
}

async function main(){
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('Interactive New Post Creator');
  const title = (await ask(rl, 'Title: ')) || 'Untitled Post';
  const today = new Date().toISOString().slice(0,10);
  let date = await ask(rl, `Date [${today}]: `); if(!date) date = today;
  let slug = await ask(rl, `Slug [auto from title]: `); if(!slug) slug = makeSlug(title);
  const tagsRaw = await ask(rl, 'Tags (comma or space separated, optional): ');
  const draftAns = (await ask(rl, 'Draft? (y/N): ')).toLowerCase();
  const draft = draftAns === 'y' || draftAns === 'yes';
  rl.close();

  const tags = tagsRaw ? tagsRaw.split(/[, ]+/).filter(Boolean) : [];
  const postsDir = path.join(process.cwd(), 'notes', 'posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive:true });
  const file = path.join(postsDir, `${slug}.md`);
  if (fs.existsSync(file)) {
    console.error('File already exists:', file);
    process.exit(2);
  }
  const fm = `---\ntitle: "${title}"\ndate: "${date}"\nslug: "${slug}"${draft?'\ndraft: true':''}${tags.length?`\ntags: [${tags.map(t=>`'${t}'`).join(', ')}]`:''}\n---\n\n# ${title}\n\nWrite something awesome.\n`;
  fs.writeFileSync(file, fm, 'utf8');
  console.log('Created', path.relative(process.cwd(), file));
  const editor = process.env.EDITOR || process.env.VISUAL;
  if (editor){
    try { const { spawnSync } = await import('child_process'); spawnSync(editor, [file], { stdio: 'inherit' }); } catch {}
  } else if (process.platform === 'win32') {
    try { const { spawnSync } = await import('child_process'); spawnSync('notepad.exe', [file], { stdio: 'inherit' }); } catch {}
  }
}

main().catch(e => { console.error(e); process.exit(1); });


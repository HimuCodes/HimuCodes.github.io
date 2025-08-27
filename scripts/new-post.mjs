#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import slugify from 'slugify';

const args = process.argv.slice(2);
if (!args.length || args.includes('-h') || args.includes('--help')) {
  console.log(`Usage: npm run new -- "Title of Post" [--draft] [--slug=custom-slug] [--date=YYYY-MM-DD] [--tags=tag1,tag2]\nCreates notes/posts/<slug>.md with frontmatter.`);
  process.exit(0);
}

function param(name){
  const pref = `--${name}=`;
  const a = args.find(a=> a.startsWith(pref));
  return a? a.slice(pref.length): null;
}

const title = args[0].replace(/^['"]|['"]$/g,'');
const draft = args.includes('--draft');
const manualSlug = param('slug');
const date = param('date') || new Date().toISOString().slice(0,10);
const tagsRaw = param('tags');
const tags = tagsRaw ? tagsRaw.split(/[, ]+/).filter(Boolean) : [];

const slug = manualSlug || slugify(title, { lower:true, strict:true, remove: /[*+~.()'"!:@?]/g });
const postsDir = path.join(process.cwd(),'notes','posts');
if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive:true });
const file = path.join(postsDir, `${slug}.md`);
if (fs.existsSync(file)) {
  console.error('Refusing to overwrite existing file:', file);
  process.exit(2);
}

const fm = `---\ntitle: "${title}"\ndate: "${date}"\nslug: "${slug}"${draft?"\ndraft: true":""}${tags.length?`\ntags: [${tags.map(t=>`'${t}'`).join(', ')}]`:''}\n---\n\n# ${title}\n\nWrite something awesome.\n`;
fs.writeFileSync(file, fm, 'utf8');
console.log('Created', path.relative(process.cwd(), file));


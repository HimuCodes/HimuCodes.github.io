import { nav } from './component.js';

export default function layout({ title, body, active, base = '', headingOverride, assets = null, meta = {} }) {
    const heading = headingOverride || title.charAt(0).toUpperCase() + title.slice(1);
    const cssHref = assets ? `${base}/${assets.css.file}` : `${base}/css/style.css`;
    const starJs = assets && assets.js['starfield.js'] ? `${base}/${assets.js['starfield.js']}` : `${base}/js/starfield.js`;
    const enhJs = assets && assets.js['enhancements.js'] ? `${base}/${assets.js['enhancements.js']}` : '';
    const critical = assets && assets.css.critical ? `<style data-critical>${assets.css.critical}</style>` : '';
    const desc = escapeHtml(meta.description || `${title}`);
    const type = meta.type || 'website';
    const canonical = meta.canonical || (process.env.SITE_ORIGIN ? process.env.SITE_ORIGIN + base + (active || '/') : '');
    const date = meta.date;
    const schema = meta.schema ? `<script type="application/ld+json">${JSON.stringify(meta.schema)}</script>` : '';
    const year = new Date().getFullYear();
    const isPost = !!meta.post;
    return `<!DOCTYPE html>
<html lang="en" data-theme="classic">
<head>
<meta charset="UTF-8">
<title>himu — ${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${desc}">
<link rel="stylesheet" href="${cssHref}" fetchpriority="high">
${critical}
<link rel="alternate" type="application/rss+xml" title="RSS" href="${base}/feed.xml">
${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
<meta property="og:title" content="${escapeHtml(heading)}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="${type}">
${canonical ? `<meta property=\"og:url\" content=\"${canonical}\">` : ''}
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(heading)}">
<meta name="twitter:description" content="${desc}">
${date ? `<meta property=\"article:published_time\" content=\"${date}\">` : ''}
${schema}
<script defer data-domain="himu.me" src="https://plausible.io/js/script.js"></script>
</head>
<body data-page="${escapeHtml(title)}" class="${isPost?'is-post':''}">
<canvas id="glstars" aria-hidden="true"></canvas>
<canvas id="starfield" aria-hidden="true"></canvas>
<canvas id="shooting" aria-hidden="true"></canvas>
<header class="site-header">
  <div class="brand">
    <img src="${base}/assets/logo.png" alt="" class="logo" width="56" height="56">
    <h1 class="site-title"><span class="hash">#</span> <span class="domain">${escapeHtml(heading)}</span></h1>
  </div>
  ${nav(active, base)}
</header>
<main class="content ${title === 'home' ? 'narrow' : 'readable'}">
${body}
</main>
<footer class="site-footer">
  <div class="inner">© ${year} himu • made with <span class="heart" aria-label="love">❤</span> & curiosity</div>
</footer>
<script defer src="${starJs}"></script>
${enhJs ? `<script defer src="${enhJs}"></script>`: ''}
</body>
</html>`;
}

function escapeHtml(s){
    return s.replace(/[&<>"']/g, c=>({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
    }[c]));
}
import { nav } from './component.js';

export default function layout({ title, body, active, base = '', headingOverride }) {
    const heading = headingOverride || title.charAt(0).toUpperCase() + title.slice(1);
    return `<!DOCTYPE html>
<html lang="en" data-theme="classic">
<head>
<meta charset="UTF-8">
<title>himu — ${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="himu site - ${escapeHtml(title)}">
<link rel="stylesheet" href="${base}/css/style.css">
</head>
<body data-page="${escapeHtml(title)}">
<canvas id="starfield" aria-hidden="true"></canvas>
<canvas id="shooting" aria-hidden="true"></canvas>
<header class="site-header">
  <div class="brand">
    <img src="${base}/assets/blossom.svg" alt="" class="logo" width="56" height="56">
    <h1 class="site-title"><span class="hash">#</span> <span class="domain">${escapeHtml(heading)}</span></h1>
  </div>
  ${nav(active, base)}
</header>
<main class="content ${title === 'home' ? 'narrow' : 'readable'}">
${body}
</main>
<script defer src="${base}/js/starfield.js"></script>
</body>
</html>`;
}

function escapeHtml(s){
    return s.replace(/[&<>"]/g, c=>({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'
    }[c]));
}
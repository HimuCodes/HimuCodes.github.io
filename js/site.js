/* Active nav highlight & simple router hints */
(function() {
    const path = location.pathname;
    const map = [
        { key: '/home/', match: /\/(index\.html)?$/ },
        { key: '/about/', match: /about\.html$/ },
        { key: '/blog/', match: /\/blog(\/|\/index\.html)?$/ }
    ];
    let activeKey = '/home/';
    for (const m of map) {
        if (m.match.test(path)) { activeKey = m.key; break; }
    }
    document.querySelectorAll('[data-nav]').forEach(a => {
        if (a.getAttribute('data-nav') === activeKey) a.classList.add('active');
    });
})();

/* Blog index population */
(async function populateBlogIndex(){
    if (!document.getElementById('postsList')) return;
    try {
        const res = await fetch('/content/posts.json', { cache: 'no-cache' });
        const posts = await res.json();
        const list = document.getElementById('postsList');
        posts.sort((a,b)=> b.date.localeCompare(a.date)); // newest first
        posts.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="/post.html?slug=${encodeURIComponent(p.slug)}">
        <span class="arrow">›</span> ${p.date} - ${p.title}
      </a>`;
            list.appendChild(li);
        });
    } catch(e) {
        console.warn('Could not load posts.json', e);
    }
})();

/* Post page loader */
(async function loadPost(){
    if (document.body.dataset.page !== 'post') return;
    const params = new URLSearchParams(location.search);
    const slug = params.get('slug');
    const container = document.getElementById('postContainer');
    const heading = document.getElementById('postHeading');
    if (!slug) {
        container.innerHTML = '<p>Post not specified.</p>';
        return;
    }
    try {
        const metaRes = await fetch('/content/posts.json', { cache: 'no-cache' });
        const metas = await metaRes.json();
        const meta = metas.find(m=> m.slug === slug);
        if (meta) {
            heading.textContent = meta.title;
            document.title = `himu — ${meta.title}`;
        }
        const mdRes = await fetch(`/content/posts/${slug}.md`, { cache:'no-cache' });
        if (!mdRes.ok) throw new Error('not found');
        const text = await mdRes.text();
        if (window.marked) {
            const html = marked.parse(text, { mangle:false, headerIds:true });
            container.innerHTML = html;
            enhanceMarkdown(container);
        } else {
            container.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
        }
    } catch(e) {
        container.innerHTML = '<p>Post not found.</p>';
    }
})();

function escapeHtml(str){
    return str.replace(/[&<>"']/g, c=> ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}

/* Optional: add hash anchors to headings */
function enhanceMarkdown(rootEl){
    rootEl.querySelectorAll('h1, h2, h3').forEach(h => {
        if (!h.id) return;
        const a = document.createElement('a');
        a.href = '#' + h.id;
        a.className = 'anchor';
        a.innerHTML = '¶';
        h.appendChild(a);
    });
}
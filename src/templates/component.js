export function nav(active, base = '') {
    return `<nav class="main-nav" aria-label="Primary">
        <ul>
            <li><a href="${base}/" data-nav="/home/" ${active === '/home/' ? 'class="active"' : ''}>/home/</a></li>
            <li><a href="${base}/blog/" data-nav="/blog/" ${active === '/blog/' ? 'class="active"' : ''}>/blog/</a></li>
            <li><a href="${base}/about/" data-nav="/about/" ${active === '/about/' ? 'class="active"' : ''}>/about/</a></li>
            <li><a href="${base}/rss/" data-nav="/rss/" ${active === '/rss/' ? 'class="active"' : ''}>/rss/</a></li>
        </ul>
    </nav>`;
}

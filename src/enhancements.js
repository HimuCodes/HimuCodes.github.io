// Client-side progressive enhancements: anchors, copy buttons, footnote popovers
(function(){
  // Trailing slash normalization for directory-style pages
  try {
    var p = window.location.pathname;
    if(p.length>1 && !p.endsWith('/') && !p.split('/').pop().includes('.')){
      window.location.replace(p+'/' + window.location.search + window.location.hash);
      return; // stop further execution; page will reload
    }
  } catch(e){}
  function slugify(txt){ return txt.toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,80); }
  function enhanceHeadings(){
    document.querySelectorAll('.markdown h1, .markdown h2, .markdown h3, .markdown h4').forEach(h => {
      if (!h.id){ h.id = slugify(h.textContent); }
      if (!h.querySelector('a.anchor')){
        const a = document.createElement('a');
        a.href = '#'+h.id;
        a.className = 'anchor';
        a.setAttribute('aria-label','Permalink');
        a.textContent = '#';
        h.appendChild(a);
      }
    });
  }
  function addCopyButtons(){
    document.querySelectorAll('pre > code').forEach(code => {
      const pre = code.parentElement;
      if (pre.classList.contains('has-copy')) return;
      pre.classList.add('has-copy');
      const btn = document.createElement('button');
      btn.type='button';
      btn.className='copy-code';
      btn.textContent='copy';
      btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(code.innerText); btn.textContent='copied'; setTimeout(()=>btn.textContent='copy',1800);} catch(e){ btn.textContent='err'; setTimeout(()=>btn.textContent='copy',1800);} });
      pre.appendChild(btn);
    });
  }

  // Footnotes popovers
  function setupFootnotes(){
    const defsContainer = document.querySelector('.footnote-defs');
    if (!defsContainer) return;
    const defs = {};
    defsContainer.querySelectorAll('[data-fn-def]').forEach(d => { defs[d.getAttribute('data-fn-def')] = d.innerHTML; });
    let openPopover = null;
    function close(){ if(openPopover){ openPopover.remove(); openPopover=null; } }
    document.addEventListener('click', e => { if(openPopover && !openPopover.contains(e.target) && !e.target.classList.contains('fn-ref')) close(); });
    document.addEventListener('keydown', e => { if(e.key==='Escape') close(); });
    document.querySelectorAll('button.fn-ref').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-fn');
        if(openPopover && openPopover.getAttribute('data-open-for')===id){ close(); return; }
        close();
        const text = defs[id]; if (!text) return;
        const pop = document.createElement('div');
        pop.className='fn-popover';
        pop.setAttribute('data-open-for', id);
        pop.innerHTML = `<div class="fn-box">${text}</div>`;
        // Position horizontally inline (after button)
        btn.insertAdjacentElement('afterend', pop);
        // Adjust if overflow
        const rect = pop.getBoundingClientRect();
        if (rect.right > window.innerWidth - 12){ pop.style.left = `calc(100% - ${(rect.right - window.innerWidth + 12)}px)`; }
        openPopover = pop;
      });
    });
  }

  function run(){ enhanceHeadings(); addCopyButtons(); setupFootnotes(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();

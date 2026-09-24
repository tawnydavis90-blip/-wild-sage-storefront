(() => {
  const alwaysVisible = new Set(['all', 'home']);
  const normalize = value => String(value || '').trim().toLowerCase();
  function apply(available) {
    document.querySelectorAll('[data-filter],[data-shop-filter]').forEach(element => {
      const id = normalize(element.dataset.filter || element.dataset.shopFilter);
      if (!id || alwaysVisible.has(id)) return;
      const visible = available.has(id);
      element.hidden = !visible;
      element.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
    window.dispatchEvent(new CustomEvent('wildsage:collection-visibility-ready', { detail: { available: [...available] } }));
  }
  async function load() {
    try {
      const response = await fetch('/api/collection-availability', { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load collection availability.');
      apply(new Set((data.collections || []).map(normalize)));
    } catch (error) {
      console.warn('Collection visibility unavailable:', error);
    }
  }
  const style = document.createElement('style');
  style.textContent = '.category[hidden],[data-shop-filter][hidden],.ws-secondary-nav.category-strip .category[hidden]{display:none!important}';
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();

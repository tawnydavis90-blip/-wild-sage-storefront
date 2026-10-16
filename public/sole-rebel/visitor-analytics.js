(() => {
  const labels = [
    ['All visitors - 24 hours', 'visitors_24h'],
    ['All visitors - 7 days', 'visitors_7d'],
    ['All visitors - lifetime', 'visitors_lifetime'],
    ['Custom Socks - 24 hours', 'visitors_custom_socks_24h'],
    ['Custom Socks - 7 days', 'visitors_custom_socks_7d'],
    ['Custom Socks - lifetime', 'visitors_custom_socks_lifetime'],
    ['Other Finds - 24 hours', 'visitors_other_finds_24h'],
    ['Other Finds - 7 days', 'visitors_other_finds_7d'],
    ['Other Finds - lifetime', 'visitors_other_finds_lifetime']
  ];
  let loading = false;

  function card(label, value) {
    const element = document.createElement('div');
    element.className = 'metric visitor-metric';
    const small = document.createElement('small');
    const strong = document.createElement('strong');
    small.textContent = label;
    strong.textContent = String(Number(value || 0));
    element.append(small, strong);
    return element;
  }

  async function renderVisitorMetrics() {
    const metrics = document.querySelector('#metrics');
    if (!metrics || metrics.querySelector('.visitor-metric') || loading || !metrics.children.length) return;
    loading = true;
    try {
      const response = await fetch('/api/admin/dashboard', { credentials: 'same-origin' });
      if (!response.ok) return;
      const data = await response.json();
      const fragment = document.createDocumentFragment();
      for (const [label, key] of labels) fragment.append(card(label, data.stats?.[key]));
      metrics.prepend(fragment);
    } catch {
      // The order dashboard keeps working if analytics are temporarily unavailable.
    } finally {
      loading = false;
    }
  }

  const metrics = document.querySelector('#metrics');
  if (!metrics) return;
  new MutationObserver(() => void renderVisitorMetrics()).observe(metrics, { childList: true });
  void renderVisitorMetrics();
})();

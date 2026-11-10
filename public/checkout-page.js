(() => {
  const form = document.querySelector('#deliveryForm');
  const button = document.querySelector('#continuePayment');
  const message = document.querySelector('#checkoutError');
  const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
  const states = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY';
  for (const code of states.split(' ')) { const o = document.createElement('option'); o.value = code; o.textContent = code; form.elements.region.appendChild(o); }
  function cart() { try { const c = JSON.parse(localStorage.getItem('wildSageCart') || '[]'); return Array.isArray(c) ? c : []; } catch { return []; } }
  function render() {
    const items = cart();
    const host = document.querySelector('#checkoutItems'); host.replaceChildren();
    for (const item of items) {
      const row = document.createElement('div'); row.className = 'checkout-item';
      if (/^https:\/\//.test(item.image || '')) { const image = document.createElement('img'); image.src = item.image; image.alt = ''; row.appendChild(image); }
      const copy = document.createElement('div');
      for (const text of [item.title || 'Wild Sage item', item.variantTitle || '', `${money(Number(item.price || 0))} × ${Number(item.quantity || 1)}`]) { const p = document.createElement('p'); p.textContent = text; copy.appendChild(p); }
      row.appendChild(copy); host.appendChild(row);
    }
    document.querySelector('#checkoutSubtotal').textContent = money(items.reduce((s,x) => s + Number(x.price || 0) * Number(x.quantity || 1),0));
    button.disabled = !items.length;
    if (!items.length) message.textContent = 'Your bag is empty. Return to the shop to choose your pieces.';
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    const items = cart(); if (!items.length) { render(); return; }
    button.disabled = true; button.textContent = 'Calculating shipping & opening payment…'; message.textContent = '';
    try {
      const address = Object.fromEntries(new FormData(form)); address.country = 'US';
      const response = await fetch('/api/checkout-shipping', {method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({items:items.map(x=>({productId:x.productId,variantId:x.variantId,quantity:x.quantity})),address})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to open payment. Please try again.');
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Unable to open secure payment. Please try again.');
      window.dispatchEvent(new CustomEvent('wildsage:checkout-ready'));
      location.href = url.href;
    } catch (error) { message.textContent = error.message || 'Unable to open payment. Please try again.'; button.disabled = false; button.textContent = 'Continue to secure payment →'; }
  });
  window.addEventListener('pageshow', () => { render(); button.textContent = 'Continue to secure payment →'; });
  window.addEventListener('storage', render);
  render();
})();

// Keep the bag focused on the order; collect delivery details once at checkout.
(() => {
  const button = document.querySelector('#checkoutBtn');
  if (!button || new URLSearchParams(location.search).get('test') === '1') return;
  button.textContent = 'Continue to checkout';
  button.onclick = () => {
    const message = document.querySelector('#checkoutMessage');
    try {
      const cart = JSON.parse(localStorage.getItem('wildSageCart') || '[]');
      if (!Array.isArray(cart) || !cart.length) { message.textContent = 'Your bag is empty.'; return; }
      location.href = '/checkout.html';
    } catch { message.textContent = 'Unable to read your bag. Please refresh and try again.'; }
  };
})();
if (new URLSearchParams(location.search).get('bag') === 'open') {
  if (typeof window.openBag === 'function') window.openBag();
}

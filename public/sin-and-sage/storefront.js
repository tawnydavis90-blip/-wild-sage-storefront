const toggle = document.getElementById('menuToggle');
const links = document.getElementById('mobileLinks');
function closeMenu() {
  links.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open menu');
}
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  links.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
links.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('click', e => { if (!e.target.closest('.nav')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
const bag = document.getElementById('bagDialog');
document.getElementById('bagPreview').addEventListener('click', () => { closeMenu(); bag.showModal(); });
bag.querySelectorAll('button').forEach(button => button.addEventListener('click', () => bag.close()));
bag.addEventListener('click', e => { if (e.target === bag) { const r = bag.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) bag.close(); } });
document.querySelectorAll('[data-category]').forEach(a => a.addEventListener('click', () => {
  document.getElementById('launchCategory').textContent = a.dataset.category + ' · Coming soon';
}));

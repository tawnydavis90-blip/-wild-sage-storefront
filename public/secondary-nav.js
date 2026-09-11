(()=>{
  if(location.pathname==='/'||document.querySelector('.ws-secondary-nav')) return;
  const links=[
    ['⌂','Home','/'],['☾','All','/#drop'],['☼','Crops','/collections/crops'],['☽','Tanks','/collections/tanks'],['✦','Tees','/collections/tees'],['◇','Hoodies','/collections/hoodies'],['♢','Pants','/collections/pants'],['☠','Dark Hippie','/collections/dark%20hippie'],['✿','Fall Drop','/collections/fall']
  ];
  const nav=document.createElement('nav');
  nav.className='ws-secondary-nav';
  nav.setAttribute('aria-label','Wild Sage collections');
  const current=decodeURIComponent(location.pathname).toLowerCase();
  nav.innerHTML=links.map(([icon,label,href])=>`<a class="ws-category${current===decodeURIComponent(href).toLowerCase()?' active':''}${label==='Home'?' home':''}" href="${href}"><span>${icon}</span><strong>${label}</strong></a>`).join('');
  const collectionTop=document.querySelector('.collection-top');
  const siteHeader=document.querySelector('.site-header');
  const brand=document.querySelector('.brand');
  if(collectionTop) collectionTop.insertAdjacentElement('afterend',nav);
  else if(siteHeader) siteHeader.insertAdjacentElement('afterend',nav);
  else if(brand) brand.insertAdjacentElement('afterend',nav);
  else document.body.insertBefore(nav,document.body.firstChild?.nextSibling||null);
  const style=document.createElement('style');
  style.textContent=`
    .ws-secondary-nav{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:clamp(18px,3.5vw,62px)!important;width:100%!important;margin:0!important;padding:26px clamp(22px,4vw,58px) 30px!important;background:#0b0d09!important;border:0!important;border-bottom:1px solid rgba(238,231,220,.08)!important;overflow-x:auto!important;scrollbar-width:none!important;position:relative!important;z-index:29!important}
    .ws-secondary-nav::-webkit-scrollbar{display:none!important}
    .ws-secondary-nav .ws-category{flex:0 0 auto!important;min-width:74px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;padding:0!important;border:0!important;background:transparent!important;color:#aaa397!important;text-decoration:none!important;text-transform:uppercase!important;box-shadow:none!important}
    .ws-secondary-nav .ws-category span{display:grid!important;place-items:center!important;width:68px!important;height:68px!important;border:1px solid rgba(170,124,89,.32)!important;border-radius:50%!important;background:transparent!important;color:#b8a28c!important;font-family:"Cormorant Garamond",Georgia,serif!important;font-size:1.55rem!important;line-height:1!important;transition:.18s ease!important}
    .ws-secondary-nav .ws-category strong{font:600 .72rem/1 Inter,system-ui,sans-serif!important;color:inherit!important;white-space:nowrap!important;letter-spacing:0!important}
    .ws-secondary-nav .ws-category:hover span{border-color:#b98277!important;color:#d5b59a!important;transform:translateY(-1px)!important}
    .ws-secondary-nav .ws-category.active{color:#eee7dc!important}
    .ws-secondary-nav .ws-category.active span{border-color:#b98277!important;box-shadow:0 0 0 1px rgba(185,130,119,.24)!important;color:#e0b993!important}
    .ws-secondary-nav .ws-category.home span{font-size:1.05rem!important}
    @media(max-width:900px){.ws-secondary-nav{justify-content:flex-start!important;gap:28px!important;padding:20px 18px 24px!important;-webkit-overflow-scrolling:touch!important}.ws-secondary-nav .ws-category{min-width:68px!important}.ws-secondary-nav .ws-category span{width:62px!important;height:62px!important}.ws-secondary-nav .ws-category strong{font-size:.68rem!important}}
  `;
  document.head.appendChild(style);
})();

(()=>{
  if(location.pathname==='/'||document.querySelector('.ws-secondary-nav')) return;
  const links=[
    ['⌂','Home','home','/'],['☾','All','all','/#drop'],['☼','Crops','crops','/collections/crops'],['☽','Tanks','tanks','/collections/tanks'],['✦','Tees','tees','/collections/tees'],['◇','Hoodies','hoodies','/collections/hoodies'],['♢','Pants','pants','/collections/pants'],['☠','Dark Hippie','dark hippie','/collections/dark%20hippie'],['✿','Fall Drop','fall','/collections/fall']
  ];
  const nav=document.createElement('nav');
  nav.className='ws-secondary-nav category-strip';
  nav.setAttribute('aria-label','Shop categories');
  const current=decodeURIComponent(location.pathname).toLowerCase();
  nav.innerHTML=links.map(([icon,label,filter,href])=>`<a class="category${current===decodeURIComponent(href).toLowerCase()?' active':''}" data-filter="${filter}" href="${href}"><span>${icon}</span>${label}</a>`).join('');
  const collectionTop=document.querySelector('.collection-top');
  const siteHeader=document.querySelector('.site-header');
  const brand=document.querySelector('.brand');
  if(collectionTop) collectionTop.insertAdjacentElement('afterend',nav);
  else if(siteHeader) siteHeader.insertAdjacentElement('afterend',nav);
  else if(brand) brand.insertAdjacentElement('afterend',nav);
  else document.body.insertBefore(nav,document.body.firstChild?.nextSibling||null);
  const style=document.createElement('style');
  style.textContent=`
    .ws-secondary-nav.category-strip{display:flex!important;flex-wrap:nowrap!important;align-items:stretch!important;justify-content:center!important;gap:clamp(5px,.65vw,10px)!important;width:100%!important;margin:0!important;padding:26px clamp(10px,2vw,28px)!important;border:0!important;border-bottom:1px solid rgba(238,231,220,.2)!important;background:#0b0e0a!important;overflow-x:auto!important;scrollbar-width:none!important;position:relative!important;z-index:29!important}
    .ws-secondary-nav::-webkit-scrollbar{display:none!important}
    .ws-secondary-nav.category-strip .category{flex:1 1 0!important;min-width:0!important;width:auto!important;border:0!important;background:transparent!important;cursor:pointer!important;text-transform:uppercase!important;letter-spacing:.04em!important;font-size:clamp(.62rem,.72vw,.78rem)!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:9px!important;opacity:.75!important;padding:14px clamp(6px,.8vw,13px)!important;white-space:nowrap!important;color:#eee7dc!important;text-decoration:none!important;font-family:Inter,system-ui,-apple-system,sans-serif!important;font-weight:400!important;line-height:1.5!important}
    .ws-secondary-nav.category-strip .category span{display:grid!important;place-items:center!important;width:68px!important;height:68px!important;border:1px solid rgba(216,190,164,.3)!important;border-radius:50%!important;font-family:serif!important;font-size:2rem!important;color:#c5a78e!important;background:radial-gradient(circle at 40% 30%,rgba(139,149,126,.18),rgba(0,0,0,.15))!important;margin-right:clamp(2px,.3vw,5px)!important;line-height:1!important}
    .ws-secondary-nav.category-strip .category.active,.ws-secondary-nav.category-strip .category:hover{opacity:1!important;color:#dfc7b1!important}
    @media(max-width:900px){.ws-secondary-nav.category-strip{justify-content:flex-start!important;-webkit-overflow-scrolling:touch!important}.ws-secondary-nav.category-strip .category{flex:0 0 auto!important;min-width:max-content!important;padding:13px 15px!important;font-size:.7rem!important}}
    @media(max-width:600px){.ws-secondary-nav.category-strip{padding:18px 12px!important}.ws-secondary-nav.category-strip .category span{width:58px!important;height:58px!important}}
  `;
  document.head.appendChild(style);
})();

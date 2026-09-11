(()=>{
  if(location.pathname==='/'||document.querySelector('.ws-secondary-nav')) return;
  const links=[
    ['⌂','Home','/'],['✦','All','/#drop'],['☾','Crops','/collections/crops'],['✿','Tanks','/collections/tanks'],['♢','Tees','/collections/tees'],['☁','Hoodies','/collections/hoodies'],['⌇','Pants','/collections/pants'],['☽','Dark Hippie','/collections/dark%20hippie'],['✧','Fall Drop','/collections/fall']
  ];
  const nav=document.createElement('nav');
  nav.className='ws-secondary-nav category-strip';
  nav.setAttribute('aria-label','Wild Sage collections');
  const current=decodeURIComponent(location.pathname).toLowerCase();
  nav.innerHTML=links.map(([icon,label,href])=>`<a class="category${current===decodeURIComponent(href).toLowerCase()?' active':''}" href="${href}"><span class="ws-category-icon">${icon}</span><strong>${label}</strong></a>`).join('');
  const target=document.querySelector('.site-header,.collection-top,.brand,main');
  if(target?.classList?.contains('site-header')||target?.classList?.contains('collection-top')) target.insertAdjacentElement('afterend',nav);
  else if(target?.classList?.contains('brand')) target.insertAdjacentElement('afterend',nav);
  else document.body.insertBefore(nav,document.body.firstChild?.nextSibling||null);
  const style=document.createElement('style');
  style.textContent=`
    .ws-secondary-nav.category-strip{display:flex!important;flex-wrap:nowrap!important;align-items:stretch!important;justify-content:center!important;gap:10px!important;width:min(1240px,calc(100% - 32px))!important;margin:18px auto 30px!important;padding:0!important;background:transparent!important;border:0!important;overflow-x:auto!important;scrollbar-width:none!important;position:relative!important;z-index:50!important}
    .ws-secondary-nav::-webkit-scrollbar{display:none!important}
    .ws-secondary-nav .category{flex:1 1 0!important;min-width:112px!important;max-width:150px!important;height:116px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:9px!important;padding:10px!important;white-space:nowrap!important;border:1px solid rgba(238,231,220,.20)!important;border-radius:2px!important;background:#11140f!important;color:#aaa397!important;text-decoration:none!important;box-shadow:none!important;transition:.18s ease!important}
    .ws-secondary-nav .category .ws-category-icon{display:grid!important;place-items:center!important;width:68px!important;height:68px!important;min-width:68px!important;min-height:68px!important;margin:0!important;border:1px solid rgba(170,124,89,.30)!important;border-radius:50%!important;background:rgba(170,124,89,.04)!important;color:#c4b5a6!important;font-family:"Cormorant Garamond",Georgia,serif!important;font-size:1.12rem!important;line-height:1!important}
    .ws-secondary-nav .category strong{display:block!important;font:700 .78rem/1 Inter,system-ui,sans-serif!important;letter-spacing:0!important;color:inherit!important}
    .ws-secondary-nav .category:hover{background:#171b13!important;border-color:rgba(238,231,220,.36)!important;transform:translateY(-2px)!important}
    .ws-secondary-nav .category.active{background:#9ca78c!important;color:#0b0d09!important;border-color:#b5c0a4!important;outline:none!important}
    .ws-secondary-nav .category.active .ws-category-icon{border-color:#c98e91!important;background:rgba(238,231,220,.08)!important;color:#0b0d09!important}
    .ws-secondary-nav .category:first-child{background:#bdb6aa!important;color:#0b0d09!important;border-color:#bdb6aa!important}
    .ws-secondary-nav .category:first-child .ws-category-icon{background:rgba(11,13,9,.06)!important;color:#0b0d09!important;border-color:rgba(11,13,9,.06)!important}
    @media(max-width:900px){.ws-secondary-nav.category-strip{justify-content:flex-start!important;width:calc(100% - 20px)!important;margin:12px auto 22px!important;-webkit-overflow-scrolling:touch!important}.ws-secondary-nav .category{flex:0 0 122px!important;min-width:122px!important;height:112px!important}.ws-secondary-nav .category .ws-category-icon{width:64px!important;height:64px!important;min-width:64px!important;min-height:64px!important}}
  `;
  document.head.appendChild(style);
})();

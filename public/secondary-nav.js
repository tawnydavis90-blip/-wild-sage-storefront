(()=>{
  if(location.pathname==='/'||document.querySelector('.ws-secondary-nav')) return;
  const links=[
    ['⌂','Home','/'],['✦','All','/#drop'],['☾','Crops','/collections/crops'],['✿','Tanks','/collections/tanks'],['♢','Tees','/collections/tees'],['☁','Hoodies','/collections/hoodies'],['⌇','Pants','/collections/pants'],['☽','Dark Hippie','/collections/dark%20hippie'],['✧','Fall Drop','/collections/fall']
  ];
  const nav=document.createElement('nav');
  nav.className='ws-secondary-nav category-strip';
  nav.setAttribute('aria-label','Wild Sage collections');
  const current=decodeURIComponent(location.pathname).toLowerCase();
  nav.innerHTML=links.map(([icon,label,href])=>`<a class="category${current===decodeURIComponent(href).toLowerCase()?' active':''}" href="${href}"><span>${icon}</span>${label}</a>`).join('');
  const target=document.querySelector('.site-header,.collection-top,.brand,main');
  if(target?.classList?.contains('site-header')||target?.classList?.contains('collection-top')) target.insertAdjacentElement('afterend',nav);
  else if(target?.classList?.contains('brand')) target.insertAdjacentElement('afterend',nav);
  else document.body.insertBefore(nav,document.body.firstChild?.nextSibling||null);
  const style=document.createElement('style');
  style.textContent=`
    .ws-secondary-nav.category-strip{
      display:flex!important;flex-wrap:nowrap!important;align-items:stretch!important;justify-content:center!important;
      gap:clamp(5px,.65vw,10px)!important;width:min(1240px,calc(100% - 32px))!important;margin:18px auto 30px!important;
      padding:0 clamp(10px,2vw,28px)!important;background:transparent!important;border:0!important;overflow-x:auto!important;
      scrollbar-width:none!important;position:relative!important;z-index:50!important;
    }
    .ws-secondary-nav::-webkit-scrollbar{display:none!important}
    .ws-secondary-nav .category{
      flex:1 1 0!important;min-width:0!important;width:auto!important;display:flex!important;align-items:center!important;justify-content:center!important;
      gap:5px!important;padding:14px clamp(6px,.8vw,13px)!important;white-space:nowrap!important;
      border:1px solid rgba(238,231,220,.22)!important;border-radius:2px!important;background:#141710!important;color:#eee7dc!important;
      font:600 clamp(.62rem,.72vw,.78rem)/1 Inter,system-ui,sans-serif!important;text-transform:uppercase!important;letter-spacing:.04em!important;
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.015)!important;transition:.18s ease!important;text-decoration:none!important;
    }
    .ws-secondary-nav .category span{font-family:"Cormorant Garamond",serif!important;font-size:1.05rem!important;line-height:1!important;color:#d6c1ae!important;margin-right:1px!important}
    .ws-secondary-nav .category:hover{background:#1b2017!important;border-color:rgba(238,231,220,.38)!important;transform:translateY(-1px)!important}
    .ws-secondary-nav .category.active{background:#8f9980!important;color:#0b0d09!important;border-color:#aab39d!important;outline:none!important}
    .ws-secondary-nav .category.active span{color:#0b0d09!important}
    .ws-secondary-nav .category:first-child{background:#d9d0c2!important;color:#0b0d09!important;border-color:#d9d0c2!important}
    .ws-secondary-nav .category:first-child span{color:#0b0d09!important}
    @media(max-width:900px){
      .ws-secondary-nav.category-strip{justify-content:flex-start!important;width:calc(100% - 20px)!important;margin:12px auto 22px!important;padding:0!important;-webkit-overflow-scrolling:touch!important}
      .ws-secondary-nav .category{flex:0 0 auto!important;min-width:max-content!important;padding:13px 15px!important;font-size:.7rem!important}
    }
  `;
  document.head.appendChild(style);
})();

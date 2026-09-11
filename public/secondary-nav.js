(()=>{
  if(location.pathname==='/'||document.querySelector('.ws-secondary-nav')) return;
  const links=[
    ['Home','/'],['All','/#drop'],['Crops','/collections/crops'],['Tanks','/collections/tanks'],['Tees','/collections/tees'],['Hoodies','/collections/hoodies'],['Pants','/collections/pants'],['Dark Hippie','/collections/dark%20hippie'],['Fall Drop','/collections/fall']
  ];
  const nav=document.createElement('nav');
  nav.className='ws-secondary-nav';
  nav.setAttribute('aria-label','Wild Sage collections');
  const current=decodeURIComponent(location.pathname).toLowerCase();
  nav.innerHTML=links.map(([label,href])=>`<a href="${href}"${current===decodeURIComponent(href).toLowerCase()?' class="active"':''}>${label}</a>`).join('');
  const target=document.querySelector('.site-header,.collection-top,.brand,main');
  if(target?.classList?.contains('site-header')||target?.classList?.contains('collection-top')) target.insertAdjacentElement('afterend',nav);
  else if(target?.classList?.contains('brand')) target.insertAdjacentElement('afterend',nav);
  else document.body.insertBefore(nav,document.body.firstChild?.nextSibling||null);
  const style=document.createElement('style');
  style.textContent=`.ws-secondary-nav{display:flex;align-items:center;gap:8px;width:min(1240px,calc(100% - 32px));margin:14px auto 28px;padding:8px;overflow-x:auto;scrollbar-width:none;border:1px solid rgba(238,231,220,.14);background:rgba(11,13,9,.92);backdrop-filter:blur(10px);position:relative;z-index:50}.ws-secondary-nav::-webkit-scrollbar{display:none}.ws-secondary-nav a{flex:0 0 auto;text-decoration:none!important;color:#eee7dc!important;border:1px solid rgba(238,231,220,.18);padding:9px 13px;border-radius:999px;font:600 .68rem/1 Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;background:rgba(255,255,255,.02)}.ws-secondary-nav a:first-child{background:#eee7dc;color:#0b0d09!important}.ws-secondary-nav a.active{outline:1px solid #b98277;outline-offset:1px}@media(max-width:640px){.ws-secondary-nav{width:calc(100% - 20px);margin:10px auto 20px;padding:7px}.ws-secondary-nav a{padding:8px 11px;font-size:.64rem}}`;
  document.head.appendChild(style);
})();

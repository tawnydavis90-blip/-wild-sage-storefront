document.addEventListener('DOMContentLoaded',()=>{
  if(!document.querySelector('script[src^="/collection-visibility.js"]')){const visibility=document.createElement('script');visibility.src='/collection-visibility.js?v=4';visibility.defer=true;document.body.appendChild(visibility)}
  const menu=document.querySelector('.shop-menu'),trigger=document.querySelector('.shop-trigger');
  if(!menu||!trigger)return;
  const dropdown=menu.querySelector('.shop-dropdown');
  if(dropdown&&!dropdown.querySelector('[data-shop-filter="pants"]')){
    const pants=document.createElement('a');
    pants.href='/collections/pants';
    pants.dataset.shopFilter='pants';
    pants.textContent='Pants';
    pants.hidden=true;
    const hoodies=dropdown.querySelector('[data-shop-filter="hoodies"]');
    hoodies?.insertAdjacentElement('afterend',pants);
  }
  const strip=document.querySelector('.category-strip');
  if(strip&&!strip.querySelector('[data-filter="pants"]')){
    const pantsButton=document.createElement('button');
    pantsButton.className='category';
    pantsButton.dataset.filter='pants';
    pantsButton.innerHTML='<span>♢</span>Pants';
    pantsButton.hidden=true;
    const hoodies=strip.querySelector('[data-filter="hoodies"]');
    hoodies?.insertAdjacentElement('afterend',pantsButton);
  }
  trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-haspopup','true');
  trigger.addEventListener('click',e=>{
    e.preventDefault();
    const open=menu.classList.toggle('open');
    trigger.setAttribute('aria-expanded',String(open));
  });
  trigger.addEventListener('keydown',e=>{
    if(e.key==='Escape'){menu.classList.remove('open');trigger.setAttribute('aria-expanded','false');trigger.focus();}
  });
  document.addEventListener('click',e=>{
    if(!menu.contains(e.target)){menu.classList.remove('open');trigger.setAttribute('aria-expanded','false');}
  });
  document.querySelectorAll('[data-shop-filter]').forEach(link=>link.addEventListener('click',e=>{
    const filter=link.dataset.shopFilter;
    if(filter==='all'){
      e.preventDefault();
      location.href='/collections/all';
      return;
    }
    e.preventDefault();
    location.href=`/collections/${encodeURIComponent(filter)}`;
  }));
  document.addEventListener('click',e=>{
    const category=e.target.closest?.('.category');
    if(!category)return;
    const filter=category.dataset.filter;
    if(!filter||filter==='all')return;
    e.preventDefault();e.stopImmediatePropagation();
    location.href=`/collections/${encodeURIComponent(filter)}`;
  },true);
});

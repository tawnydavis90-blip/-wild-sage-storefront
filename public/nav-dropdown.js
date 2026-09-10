document.addEventListener('DOMContentLoaded',()=>{
  const menu=document.querySelector('.shop-menu'),trigger=document.querySelector('.shop-trigger');
  if(!menu||!trigger)return;
  const dropdown=menu.querySelector('.shop-dropdown');
  if(dropdown&&!dropdown.querySelector('[data-shop-filter="pants"]')){
    const pants=document.createElement('a');
    pants.href='/collections/pants';
    pants.dataset.shopFilter='pants';
    pants.textContent='Pants';
    const hoodies=dropdown.querySelector('[data-shop-filter="hoodies"]');
    hoodies?.insertAdjacentElement('afterend',pants);
  }
  const strip=document.querySelector('.category-strip');
  if(strip&&!strip.querySelector('[data-filter="pants"]')){
    const pantsButton=document.createElement('button');
    pantsButton.className='category';
    pantsButton.dataset.filter='pants';
    pantsButton.innerHTML='<span>♢</span>Pants';
    const hoodies=strip.querySelector('[data-filter="hoodies"]');
    hoodies?.insertAdjacentElement('afterend',pantsButton);
  }
  trigger.addEventListener('click',e=>{
    if(window.matchMedia('(max-width:820px)').matches){
      e.preventDefault();menu.classList.toggle('open');trigger.setAttribute('aria-expanded',menu.classList.contains('open')?'true':'false');
    }
  });
  document.addEventListener('click',e=>{
    if(!menu.contains(e.target)){menu.classList.remove('open');trigger.setAttribute('aria-expanded','false');}
  });
  document.querySelectorAll('[data-shop-filter]').forEach(link=>link.addEventListener('click',e=>{
    const filter=link.dataset.shopFilter;
    if(filter==='all'){
      e.preventDefault();
      location.href='/#drop';
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
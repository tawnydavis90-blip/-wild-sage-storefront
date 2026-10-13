(()=>{
  const style=document.createElement('style');
  style.textContent=`.ws-circle-logo{display:inline-block;position:relative;flex:none;width:132px;height:132px;border-radius:50%;overflow:hidden;vertical-align:middle}.ws-circle-logo img{position:absolute!important;width:331.0345%!important;height:auto!important;max-width:none!important;left:-10.3448%!important;top:-6.8966%!important;margin:0!important;padding:0!important;display:block!important}.ws-circle-logo[data-palette="dark"] img{left:-116.3793%!important}.brand.ws-logo-link{display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;line-height:1!important}.footer-brand .ws-circle-logo{width:160px;height:160px}.ws-logo-back{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:16px!important}.ws-logo-back .ws-circle-logo{width:108px;height:108px}@media(max-width:760px){.brand .ws-circle-logo{width:94px;height:94px}.site-header .brand{min-width:94px!important}.footer-brand .ws-circle-logo{width:132px;height:132px}}`;
  document.head.appendChild(style);
  function palette(element){
    for(let p=element;p;p=p.parentElement){
      const color=getComputedStyle(p).backgroundColor,match=color.match(/rgba?\(([^)]+)\)/);
      if(!match)continue;
      const channels=match[1].split(',').map(Number);
      if(channels.length===4&&channels[3]<.9)continue;
      return (.2126*channels[0]+.7152*channels[1]+.0722*channels[2])>150?'dark':'light';
    }
    return 'light';
  }
  function logo(element){
    const frame=document.createElement('span');frame.className='ws-circle-logo';frame.dataset.palette=palette(element);
    const img=document.createElement('img');img.src='/branding/moon-sage-logo-sheet.png';img.alt='Wild Sage Apparel — Wear Your Contradiction';img.width=1536;img.height=1024;
    frame.appendChild(img);return frame;
  }
  document.querySelectorAll('a.brand,.footer-brand').forEach(element=>{
    if(element.tagName==='A')element.setAttribute('aria-label','Wild Sage Apparel home');
    element.replaceChildren(logo(element));element.classList.add('ws-logo-link');
  });
  if(!document.querySelector('a.brand')){
    const back=document.querySelector('a.back,a.policy-back');
    if(back){back.prepend(logo(back));back.classList.add('ws-logo-back');}
  }
})();

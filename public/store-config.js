(() => {
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const setText=(selector,value)=>{const el=$(selector);if(el&&typeof value==='string'&&value)el.textContent=value;};
  async function apply(){
    try{
      const res=await fetch('/api/store-config',{headers:{Accept:'application/json'}}),data=await res.json();
      if(!res.ok)return;
      const s=data.settings||{};
      setText('.announcement span:first-child',s.announcementLeft);
      setText('.announcement-right',s.announcementRight);
      setText('.hero-copy .eyebrow',s.heroEyebrow);
      const title=$('.hero-copy h1'); if(title&&s.heroTitle)title.innerHTML=String(s.heroTitle).split('\n').map(x=>x.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))).join('<br>');
      const kicker=$('.hero-kicker'); if(kicker&&s.heroKicker)kicker.innerHTML=String(s.heroKicker).split('\n').map(x=>x.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))).join('<br>');
      setText('#about .eyebrow',s.aboutEyebrow);setText('#about h2',s.aboutTitle);setText('#about p:last-child',s.aboutText);
      const contact=$('footer a[href^="mailto:"]');if(contact&&s.contactEmail)contact.href=`mailto:${s.contactEmail}`;
      const byId=new Map((data.collections||[]).map(c=>[String(c.id),c]));
      const strip=$('.category-strip'); if(strip){const buttons=$$('.category',strip);buttons.forEach(btn=>{const c=byId.get(String(btn.dataset.filter));if(c){btn.hidden=!c.enabled;const icon=btn.querySelector('span')?.outerHTML||'';btn.innerHTML=`${icon}${c.label}`;btn.dataset.order=String(c.sortOrder||0);}});buttons.sort((a,b)=>Number(a.dataset.order||0)-Number(b.dataset.order||0)).forEach(b=>strip.appendChild(b));}
      const toggleSections=()=>{const f=$('#featuredSection'),b=$('#bestSellerSection');if(f)f.hidden=s.featuredEnabled===false;if(b)b.hidden=s.bestSellersEnabled===false;};
      toggleSections();window.addEventListener('wildsage:showcases-ready',toggleSections);setTimeout(toggleSections,500);
    }catch(err){console.warn('Store config unavailable:',err);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();

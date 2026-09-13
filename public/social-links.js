(()=>{
  const icons={
    instagram:`<svg viewBox="0 0 64 64"><rect x="15" y="15" width="34" height="34" rx="10"/><circle cx="32" cy="32" r="8"/><path d="M42 22h.1"/></svg>`,
    facebook:`<svg viewBox="0 0 64 64"><path d="M36 51V34h7l1-8h-8v-5c0-2.7 1.4-4 4.6-4H45v-7c-1.9-.3-4-.5-6.3-.5-7 0-11.7 4.2-11.7 12v4.5h-8v8h8v17"/></svg>`,
    tiktok:`<svg viewBox="0 0 64 64"><path d="M37 13v25.5a10.5 10.5 0 1 1-8-10.2"/><path d="M37 13c1.5 7.3 5.4 11.5 12 12.8"/></svg>`,
    pinterest:`<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20"/><path d="M28 45c2-7 4-14 5.2-20.2.8-4 5.5-3.2 5.5.2 0 5-4.4 9-8.5 6.5-6.5-4-4.8-15.5 3-18.2 8.5-3 16.2 2.6 16.2 10.6 0 10.5-7.4 18.2-17.8 18.2-2.2 0-4.2-.5-5.8-1.3"/></svg>`
  };
  const labels={instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',pinterest:'Pinterest'},order=['instagram','facebook','tiktok','pinterest'];
  async function start(){
    if(window.__wildSageSocialBuilt)return;window.__wildSageSocialBuilt=true;
    const existing=[...document.querySelectorAll('.ws-social-links')];if(existing.length){existing.slice(1).forEach(x=>x.remove());return;}
    let links={
      instagram:'https://www.instagram.com/wildsageapparelco?stkn=MTk0enU1ZHFpcjR0Yg%3D%3D&utm_source=qr',
      facebook:'https://www.facebook.com',
      tiktok:'',
      pinterest:''
    };
    try{const r=await fetch('/api/social-links',{headers:{Accept:'application/json'}});if(r.ok){const d=await r.json();const saved=d.links||{};links={...links,...Object.fromEntries(Object.entries(saved).filter(([,v])=>String(v||'').trim()))}}}catch(e){console.warn('Social links unavailable',e)}
    if(document.querySelector('.ws-social-links'))return;
    const wrap=document.createElement('section');wrap.className='ws-social-links';wrap.innerHTML=`<p class="ws-social-kicker">FOLLOW THE WILD</p><div class="ws-social-row">${order.map(key=>{const url=links[key]||'';return url?`<a class="ws-social-button" href="${String(url).replace(/"/g,'&quot;')}" target="_blank" rel="noopener noreferrer" aria-label="${labels[key]}"><span>${icons[key]}</span><strong>${labels[key]}</strong></a>`:`<div class="ws-social-button is-unlinked" aria-label="${labels[key]} not connected yet"><span>${icons[key]}</span><strong>${labels[key]}</strong></div>`}).join('')}</div>`;
    const footer=document.querySelector('footer');if(footer)footer.insertAdjacentElement('beforebegin',wrap);else document.body.appendChild(wrap);
    if(document.getElementById('ws-social-style'))return;const style=document.createElement('style');style.id='ws-social-style';style.textContent=`.ws-social-links{padding:42px 20px 34px;background:#0b0e0a;border-top:1px solid rgba(238,231,220,.12);text-align:center}.ws-social-kicker{margin:0 0 22px;color:#aaa397;font:600 .68rem/1 Inter,system-ui,sans-serif;letter-spacing:.18em}.ws-social-row{display:flex;justify-content:center;gap:clamp(22px,4vw,58px);flex-wrap:wrap}.ws-social-button{display:flex;flex-direction:column;align-items:center;gap:9px;color:#eee7dc;text-decoration:none;text-transform:uppercase;font:500 .68rem/1 Inter,system-ui,sans-serif;opacity:.82;transition:.18s ease}.ws-social-button>span{display:grid;place-items:center;width:68px;height:68px;border:1px solid rgba(216,190,164,.3);border-radius:50%;color:#c5a78e;background:radial-gradient(circle at 40% 30%,rgba(139,149,126,.18),rgba(0,0,0,.15))}.ws-social-button svg{width:31px;height:31px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.ws-social-button:hover{opacity:1;color:#dfc7b1;transform:translateY(-2px)}.ws-social-button.is-unlinked{opacity:.42;cursor:default}.ws-social-button.is-unlinked:hover{transform:none;color:#eee7dc}@media(max-width:600px){.ws-social-button>span{width:58px;height:58px}.ws-social-row{gap:24px}.ws-social-links{padding:34px 14px 28px}}`;document.head.appendChild(style)
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

(()=>{
  async function loadSocialLinks(){
    try{
      const response=await fetch('/api/social-links',{headers:{Accept:'application/json'}}),data=await response.json();
      if(!response.ok)return;
      document.querySelectorAll('[data-social]').forEach(link=>{
        const url=String(data.links?.[link.dataset.social]||'').trim();
        if(url)link.href=url;
        else link.hidden=true;
      });
    }catch(error){console.warn('Contact social links unavailable:',error)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadSocialLinks,{once:true});else loadSocialLinks();
})();

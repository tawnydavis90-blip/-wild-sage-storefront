(()=>{
 const $=id=>document.getElementById(id);
 async function request(path,body){const r=await fetch(path,{credentials:"same-origin",method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error||"Unable to sign in.");return data;}
 function open(){ $("login").classList.add("hidden");$("app").classList.remove("hidden"); }
 async function login(){try{$("err").textContent="";await request("/api/admin/login",{password:$("password").value});open();}catch(e){$("err").textContent=e.message;}}
 $("loginBtn").onclick=login;$("password").onkeydown=e=>{if(e.key==="Enter")login();};
 $("logoutBtn").onclick=async()=>{await request("/api/admin/logout",{});location.reload();};
 request("/api/admin/session").then(s=>{if(s.authenticated)open();}).catch(e=>{$("err").textContent=e.message;});
})();

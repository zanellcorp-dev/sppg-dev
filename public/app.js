(function(){
  function qs(s){return document.querySelector(s)}
  function initIcons(){ if(window.lucide) window.lucide.createIcons(); }
  document.addEventListener('DOMContentLoaded', function(){
    initIcons();
    const sidebar=qs('.sidebar'), menu=qs('.mobile-menu');
    if(menu && sidebar){ menu.addEventListener('click',function(){ sidebar.classList.toggle('open'); menu.setAttribute('aria-expanded',sidebar.classList.contains('open')?'true':'false'); }); }
    document.addEventListener('click',function(e){
      if(window.innerWidth<=820 && sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && !e.target.closest('.mobile-menu')) sidebar.classList.remove('open');
    });
    const pw=qs('#password-toggle'); if(pw){ pw.addEventListener('click',function(){ const input=qs('#password'); if(!input)return; input.type=input.type==='password'?'text':'password'; pw.setAttribute('aria-label',input.type==='password'?'Tampilkan password':'Sembunyikan password'); }); }
    document.querySelectorAll('[data-confirm]').forEach(function(el){el.addEventListener('click',function(e){if(!window.confirm(el.getAttribute('data-confirm')))e.preventDefault();});});
  });
})();

document.addEventListener('DOMContentLoaded',()=>{
  const all=document.getElementById('check-all');
  if(all) all.addEventListener('change',()=>document.querySelectorAll('.menu-check').forEach(x=>x.checked=all.checked));
});

(function(){
  function initMap(el){
    if(!window.L || el.dataset.ready) return;
    el.dataset.ready='1';
    const latInput=document.getElementById(el.dataset.latInput), lngInput=document.getElementById(el.dataset.lngInput);
    const lat=parseFloat(latInput&&latInput.value), lng=parseFloat(lngInput&&lngInput.value);
    const has=Number.isFinite(lat)&&Number.isFinite(lng);
    const center=has?[lat,lng]:[-6.6,107.7];
    const map=L.map(el,{scrollWheelZoom:false}).setView(center,has?17:10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    let marker=has?L.marker([lat,lng],{draggable:true}).addTo(map):null;
    function setPoint(a,b,pan){
      if(!Number.isFinite(a)||!Number.isFinite(b)) return;
      if(!marker) marker=L.marker([a,b],{draggable:true}).addTo(map); else marker.setLatLng([a,b]);
      if(pan) map.setView([a,b],17);
      if(latInput) latInput.value=a.toFixed(7);
      if(lngInput) lngInput.value=b.toFixed(7);
      const link=document.getElementById(el.dataset.linkId); if(link) link.href='https://www.google.com/maps?q='+a+','+b;
    }
    map.on('click',e=>setPoint(e.latlng.lat,e.latlng.lng,false));
    if(marker) marker.on('dragend',()=>{const p=marker.getLatLng();setPoint(p.lat,p.lng,false)});
    [latInput,lngInput].forEach(i=>i&&i.addEventListener('change',()=>{const a=parseFloat(latInput.value),b=parseFloat(lngInput.value);if(Number.isFinite(a)&&Number.isFinite(b))setPoint(a,b,true)}));
    const locate=document.getElementById(el.dataset.locateId);
    if(locate) locate.addEventListener('click',()=>map.locate({setView:true,maxZoom:17}));
    map.on('locationfound',e=>setPoint(e.latlng.lat,e.latlng.lng,true));
    const link=document.getElementById(el.dataset.linkId); if(link&&has) link.href='https://www.google.com/maps?q='+lat+','+lng;
    setTimeout(()=>map.invalidateSize(),100);
  }
  function boot(){document.querySelectorAll('.map-picker').forEach(initMap);document.querySelectorAll('.map-view').forEach(el=>{if(!window.L||el.dataset.ready)return;el.dataset.ready='1';const lat=parseFloat(el.dataset.lat),lng=parseFloat(el.dataset.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;const map=L.map(el,{scrollWheelZoom:false}).setView([lat,lng],17);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);L.marker([lat,lng]).addTo(map);setTimeout(()=>map.invalidateSize(),100);});}
  window.addEventListener('load',boot);
  window.SPPGMaps={boot};
})();

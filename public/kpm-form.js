(function(){
  function toggle(){
    var type=document.getElementById('kpm-type'); if(!type)return;
    var school=type.value==='SATUAN_PENDIDIKAN';
    document.getElementById('education-field').style.display=school?'':'none';
    document.getElementById('school-counts').style.display=school?'':'none';
    document.getElementById('posyandu-counts').style.display=school?'none':'';
    document.querySelectorAll('.school-only').forEach(function(x){x.style.display=school?'':'none'});
    document.querySelectorAll('.posyandu-only').forEach(function(x){x.style.display=school?'none':''});
    var edu=document.querySelector('[name="education_level"]'); if(edu)edu.required=school;
  }
  document.addEventListener('DOMContentLoaded',function(){var t=document.getElementById('kpm-type');if(t){t.addEventListener('change',toggle);toggle();}});
})();

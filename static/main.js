function _add(tmpl){
    tmpl.parent().append(tmpl.prop('content').cloneNode(true))
    return tmpl.parent().children().last()
}
function loadHint(name){
  $.ajax('/hint/'+name).then(function(data){
    $('.mct-hint').html(data);
  })
}
function getVal(o,name){

}
$(function(){
    var defs=$.get('/json');
    defs.then(function(data){
      data.forEach(function(file){
        $('.mct-header span').eq(0).text(file.tag)
        var href='panel-'+file.file.name;
        _add($('template._file_tab'))
        .find('a').text(file.file.name)
        .attr('href','#'+href)
        var tab=_add($('template._file_content'))
        tab.attr('id',href)
        $.each(file.sections,function(n,section){
          var sec=_add(tab.find('template._section'));
          sec.find('.panel-title span:eq(0)').text(section);
          var cnt=0;
          $.each(file.list[section],function(n,define){
            cnt++;
            var d=_add(sec.find('template.define'))
            var def=file.defs[define]
            if (def.changed)
              d.addClass('bg-info')
            d.find('label').text(define);
            var dis=d.find('input').eq(0).attr('checked',!(def.changed&&def.changed.disabled||def.disabled));
            var dv=(def.changed&&def.changed.value||def.value);
            if (def.type=='string')
              dv=dv.slice(1,-1)
            var val=d.find('input').eq(1).val(dv);
function processProp(name,val){
  saveProp('/set/'+file.file.name+'/'+define+'/'+name+'/'+val)
  .then(a=>applyProp(def,d,name,val))
}
function saveProp(cmd){
var state=$('.mct-header span').eq(1)
  state.text('saving...').fadeIn();
  return $.post(cmd)
  .then(a=>(state.text('saved').fadeOut(1000),a))
  .fail(a=>state.text('error'))
}
function applyProp(def,row,prop,val){
  def.changed=def.changed||{}
  def.changed[prop]=val
  var ch=['disabled','value'].filter(i=>def.changed[i]&&def.changed[i]!=def[i])
  row.toggleClass('bg-info',ch.length)
}
dis.on('change',function(){
  processProp('disabled',!dis.prop('checked'));
})
val.on('change',function(){
  var dv=$(this).val();
  if (def.type=='string')
    dv='"'+dv+'"';
  processProp('value',dv);
})
            var p=d.find('.col-sm-6 p');
            var b=d.find('button');
            if (/_adv$/.test(file.file.name))
              b.remove();
            else
              b.on('click',a=>loadHint(define))
            if (def.value == undefined)
              val.remove(),p.remove();
            if (! def.disabled && def.value != undefined)
              dis.remove(),p.remove();
          })
          sec.find('.panel-title span:eq(1)').text(cnt);
          sec.find('[type=checkbox]').bootstrapToggle()
        })
      })
      $('.config-files li:eq(0) a').eq(0).trigger('click');
    })
    var state=$('.mct-header input')
    .on('change',function(){
      if ($(this).prop('checked'))
        $('.form-group').not('.bg-info').hide()
      else
        $('.form-group').show();
//      console.log(arguments)
    })

})

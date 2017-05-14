function _add(tmpl){
    tmpl.parent().append(tmpl.prop('content').cloneNode(true))
    return tmpl.parent().children().last()
}
function loadHint(name){
  $.ajax('/hint/'+name).then(function(data){
    $('.mct-hint').html(data);
  })
}
function saveProp(cmd){
var state=$('.mct-header .mct-status')
  state.text('saving...').fadeIn().css({color:'black'});
  return $.post(cmd)
  .then(function(a){ state.text('saved').fadeOut(1000); return a})
  .fail(function(a){ state.text(''+a.responseJSON.code).css({color:'red'})})
}
function applyProp(def,row,prop,val){
  def.changed=def.changed||{}
  def.changed[prop]=val
  var ch=['disabled','value'].filter(function(i){ return i in def.changed &&def.changed[i]!=def[i]})
  row.toggleClass('bg-info',!!ch.length)
}
function updateChanged(sec){
  var cnt=sec.find('.form-group.bg-info').length;
  sec.find('.panel-title span.badge:eq(1)').text(cnt);
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
              .then(function(){ applyProp(def,d,name,val)})
              .then(function(){ updateChanged(d.parents('.panel'))})
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
              b.on('click',function(){loadHint(define)})
            if (def.value == undefined)
              val.remove(),p.remove();
            if (! def.disabled && def.value != undefined)
              dis.remove(),p.remove();
          })
          sec.find('.panel-title span.badge:eq(0)').text(cnt);
          updateChanged(sec);
          sec.find('[type=checkbox]').bootstrapToggle()
          with(sec.find('.panel-heading button')){
            eq(1).on('click',function(){sec.find('.form-group').not('.bg-info').hide()})
            eq(0).on('click',function(){sec.find('.form-group').show()})
          }
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

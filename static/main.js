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
var bootstrap_alert = function() {}
bootstrap_alert.error = function(message) {
    $('#mct-alert').html(`
<div class="alert alert-danger alert-dismissible fade in" id="mct-alert" role="alert">
  <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">×</span></button>
  <h4>Oh snap! You got an error!</h4><p></p></div>
    `).find('p').text(message)
}
function getVal(ob,name){
  if( ob.changed != undefined)
//    if( 'changed' in ob)
    return ob.changed[name]
  return ob[name]
}
// The plugin code https://gist.github.com/meleyal/3794126
$.fn.draghover = function(options) {
  return this.each(function() {
    var collection = $(),
        self = $(this);
    self.on('dragenter', function(e) {
      if (collection.length === 0) {
        self.trigger('draghoverstart');
      }
      collection = collection.add(e.target);
    });
    self.on('dragleave drop', function(e) {
      collection = collection.not(e.target);
      if (collection.length === 0) {
        self.trigger('draghoverend');
      }
    });
  });
};
function upload_files(files){
  if (files.length > 0){
    var formData = new FormData();
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      formData.append('uploads[]', file, file.name);
    }
    $('.mct-progress').show();
    $.ajax({
      url: '/upload',
      type: 'POST',
      data: formData,
      processData: false,
      contentType: false,
      success: function(data){
          console.log('upload successful!\n' + data);
      },
      xhr: function() {
        var xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', function(evt) {
          if (evt.lengthComputable) {
            // calculate the percentage of upload completed
            var percentComplete = evt.loaded / evt.total;
            percentComplete = parseInt(percentComplete * 100);
            // update the Bootstrap progress bar with the new percentage
            $('.mct-progress span').text(percentComplete + '%');
            $('.mct-progress .progress-bar').width(percentComplete + '%');
            // once the upload reaches 100%, set the progress bar text to done
            if (percentComplete === 100)
              $('.mct-progress').fadeOut(2000);
          }
        }, false);
        return xhr;
      }
    });
  }
}
$(function(){
    //uploader decoration
    var dropZone=$('#mct-dragzone')
    $(window).on('beforeunload',function(){ return "Do You want leave page?"})
    .draghover().on('draghoverstart draghoverend', function(ev) {
      dropZone.toggle(ev.type=='draghoverstart');
    });
    dropZone.on('dragover dragleave', function(ev) {
        dropZone.toggleClass('drop',ev.type=='dragover');
        if (ev.type=='dragover')
            ev.preventDefault();
    })
    dropZone.on('drop',function(e) {
        upload_files(e.originalEvent.dataTransfer.files)
        e.preventDefault();
    })
    $('button.mct-upload').on('click', function(){
      $('input.mct-upload').trigger('click')
    });
    $('input.mct-upload').on('change',function(){
      var files = $(this).get(0).files;
      upload_files(files);
    });
    //end uploader decoration

    var defs=$.get('/json');
    defs.then(function(data){
      data.forEach(function(file){
        $('.mct-tags').eq(0).text(file.tag)
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
            var dis=d.find('input').eq(0).attr('checked',!getVal(def,'disabled'))
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
            if (def.hint == undefined)
              d.find('button').remove();
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
    var m=$('#mct-tags-modal');
    var a=$('#mct-alert');
    var t=m.find('table tbody');
    m.find('button.btn-primary').on('click',function(ev){
      var row = t.find('.success');
      if(row.length){
        var tag=row.find('td').eq(1).text().split(',');
          $.ajax('/checkout/'+tag[0])
          .then(function(data){
            $(window).unbind('beforeunload');
            window.location.reload();
          })
          .fail(function(a){
            m.modal('hide')
            bootstrap_alert.error(a.responseText);
          })
      }
    });
    m.find('table tbody').on('click',function(ev){
      $(this).find('tr').removeClass('success');
      $(ev.target).parents('tr').addClass('success')
    });
    $('.mct-tags').on('click',function(){
      $.ajax('/tags').then(function(data){
        data=data.sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:0;})
        t.empty();
        data.map(function(row){
          t.append($('<tr>').append($('<td>').text(row.date)).append($('<td>').text(row.tag)))
        })
        m.modal();
      })
    })
    $('.mct-issue').on('click',function(){
      defs.then(function(data){
        var text='';
        data.forEach(function(file){
          var f='';
          $.each(file.sections,function(n,section){
            var lines='';
            $.each(file.list[section],function(n,define){
              var def=file.defs[define]
              if (def.changed){
                var ch=['disabled','value'].filter(function(i){ return i in def.changed &&def.changed[i]!=def[i]})
                if (ch.length)
                  lines+=(( ch.indexOf('disabled')>=0 ? def.changed.disabled : def.disabled)?'//':'')
                    +'#define '+define+' '
                    +(( ch.indexOf('value')>=0 ? def.changed.value : def.value)||'')
                    +'\n';
              }
            })
            if (lines)
              f+='//section '+section+'\n'+lines
          })
          if (f)
            text+='//file '+file.file.base+'\n'+f;
        })
        window.open(encodeURI('https://github.com/MarlinFirmware/Marlin/issues/new?title=&body='+text).replace(/\#/g,'%23'))
      })
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

function _add(tmpl){
    tmpl.parent().append(tmpl.prop('content').cloneNode(true))
    return tmpl.parent().children().last()
}
function addNewTab(name,href){
    _add($('template._tab_item'))
    .find('a').text(name)
    .attr('href','#'+href)

    _add($('template._nav_item'))
    .find('a').text(name)
    .attr('href','#'+href)

    var tab=_add($('template._tab_content'))
    tab.attr('id',href)
    var nav=_add($('template._nav_content'))
    nav.attr('name',href)

    return {tab:tab,nav:nav};
}
function addNewSection(tab,id,section,sec){
    var sec=_add(tab.tab.find('template.'+(sec||'_section')));
    sec.attr('id',id)
    sec.find('.card-header span:eq(0)').text(section);

    var grp=_add(tab.nav.find('template._nav'))
    grp.find('a').attr('href','#'+id).text(section);

    return sec;
}

function loadHint(name){
  return $('.mct-hint iframe').attr('src', '/hint/' + name);
  $.ajax('/hint/'+name)
  .fail(ajaxAlert)
  .then(function(data){
    $('.mct-hint').html(data);
  })
}
function loadGcode(name){
  return $('.mct-hint iframe').attr('src', '/gcode/' + name);
  $.ajax('/gcode/'+name)
  .fail(ajaxAlert)
  .then(function(data){
    $('.mct-hint').html(data).prop('scrollTop',0);
  })
}
function saveProp(cmd){
  progress(0)(true)('50%');
  return $.post(cmd)
  .then(function(a){ progress('100%')(false); return a})
  .fail(function(e){ progress(1)('ERROR: '+(e.responseText||e.state())); return ajaxAlert(e) });
}
function applyProp(def,row,prop,val){
  def.changed=def.changed||{}
  def.changed[prop]=val
  var ch=['disabled','value'].filter(function(i){ return i in def.changed &&def.changed[i]!=def[i]})
  row.toggleClass('bg-info',!!ch.length)
}
function updateChanged(sec){
  var cnt=sec.find('.form-group.bg-info').length;
  sec.find('.card-header span.badge:eq(1)').text(cnt);
}
var lastChanged;
function setProp(name,prop,val){
  var row=uiDefs[name];
  applyProp(opts[name],row,prop,val)
  updateChanged(row.parents('.card'))
  updateConditions(name)
}

function getVal(ob,name){
  if( ob.changed != undefined)
    if( name in ob.changed)
      return ob.changed[name]
  return ob[name]
}
function ajaxAlert(fail){
  _add($('template._alert'))
  .find('p').text(fail.responseText||(fail.statusText+': '+fail.state()))
  return fail;
}
function cmdReload(cmd,modal){
    cmd
    .then(function(data){
      $(window).unbind('beforeunload');
      window.location.reload();
    })
    .fail(function(e){
      modal&&modal.modal('hide')
      return ajaxAlert(e);
    })
}
function progress(val){
    var dom = $('.mct-progress');
    val===true&&dom.toggle(val);
    val===false&&dom.stop().fadeOut(3000);
    if (typeof val =='string')
      dom.find('.progress-bar').width(val).find('span').text(val);
    typeof val =='number'&& dom.find('.progress-bar').toggleClass('bg-danger',!!val);
    return progress;
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
    if ( !files.length )
      return ;//fail('no files')
    var formData = new FormData();
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      formData.append('uploads[]', file, file.name);
    }
    progress(0)(true);
    return $.ajax({
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
            progress(percentComplete + '%');
            // update the Bootstrap progress bar with the new percentage
            // once the upload reaches 100%, set the progress bar text to done
            if (percentComplete === 100){
              progress(false);
            }
          }
        }, false);
        return xhr;
      }
    }).fail(function(e){
      progress(1)('ERROR: '+(e.responseText||e.state()));
    });
}
function stream_cmd(command,proc){
    return function(){
      if (!config.pio) return proc.info();
      proc.init();
      function log_message(text){
        proc.log(text);
      }
      try{
        var xhr = new XMLHttpRequest();
        xhr.previous_text = '';
        xhr.onload = function() { log_message("<br>Done."); };
        xhr.onerror = function() { log_message("<br>[XHR] Fatal Error."); };
        xhr.onreadystatechange = function(){
          try{
            if (xhr.readyState > 2){
              var new_response = xhr.responseText.substring(xhr.previous_text.length);
              log_message(new_response);//.replace(/\n/g,'<br>'));
              xhr.previous_text = xhr.responseText;
            }
          }catch (e){
            log_message("<br><b>[XHR] Exception: " + e + "</b>");
          }
        }
        xhr.open("GET", command, true);
        xhr.send("let's go");
        return xhr;
      }catch (e){
        log_message("<br><b>[XHR] Exception: " + e + "</b>");
      }
    }
}
function toggleDef(name,state){
  if (!uiDefs[name]) return;
  var inp=uiDefs[name]
  .toggleClass('disabled',!state)
  .find('input,select')
  if(state)
    inp.removeAttr('disabled')
  else
    inp.attr('disabled','')
}
function toggleRed(tag,name){
  if (!uiDefs[tag]) return;
  var inp=uiDefs[tag].find('.col-sm-5 a').each(function(i,a){
    if ($(a).text()==name)
      $(a).replaceWith(
        $('<span>')
        .text(name)
        .css('color','red')
        .attr('title','can\'t resolve or not found in configuration!!!')
      )
  })
}
function updateConditions(name){
  if (deps[name])
    deps[name].forEach(function(d){
      checkCondition(d);
    })
  if (depsG[name])
    depsG[name].forEach(function(gcode){
      checkConditionG(gcode);
    })
}
function checkConditionG(gcode){
  var en=false;
  if(optsG[gcode])
    if(optsG[gcode].requires){
      optsG[gcode].requires.forEach(function(def){
        if (opts[def])
          en=en||!getVal(opts[def],'disabled');
        else
          en=true;
      });
      toggleDef(gcode,en);
    }
}
function checkCondition(name){
  function ENABLED(v){ return !getVal(opts[v],'disabled')}
  function DISABLED(v){ return getVal(opts[v],'disabled')}
  var res=true;
  if (opts[name])
  if (opts[name].condition){
    opts[name].condition.forEach(function(c){
        try{
          var cond=eval(c.replace(/\)/g,'")').replace(/\(/g,'("'));
          res=res&&cond;
        }catch(e){
          //console.error(e)
        }
    })
    toggleDef(name,res);
  }
}
var deps={},opts={};
var depsG={},optsG={};
var uiDefs={};
$(function(){
    //uploader decoration
    var dropZone=$('#mct-dragzone')
    $(window)
    //properly check enter & leave window
    .draghover().on('draghoverstart draghoverend', function(ev) {
      dropZone.toggle(ev.type=='draghoverstart');
    });
    $(window)
    //.on('beforeunload',function(){ return "Do You want leave page?"})
    //prevent drop on window
    .on('drop',function(ev) {
      ev.preventDefault();
    })
    .on('dragover', function(ev) {
      ev.preventDefault();
    })
    dropZone.on('dragover dragleave', function(ev) {
        dropZone.toggleClass('drop',ev.type=='dragover');
        if (ev.type=='dragover')
            ev.preventDefault();
    })
    dropZone.on('drop',function(ev) {
        ev.preventDefault();
        cmdReload(upload_files(ev.originalEvent.dataTransfer.files))
    })
    $('button.mct-upload').on('click', function(){
      $('input.mct-upload').trigger('click')
    });
    $('input.mct-upload').on('change',function(){
      var files = $(this).get(0).files;
      cmdReload(upload_files(files));
    });
    //end uploader decoration
    var tooltip_large={template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner large"></div></div>'};
    var defs=$.get('/json');
    var gcodes=$.get('/gcodes');
    var snippets=$.get('/snippets');
    var tabGcodes=addNewTab('Gcodes','card-gcodes');
    var tabSnippets=addNewTab('Snippets','card-snippets');
    defs.then(function(data){
      data.forEach(function(file){
        $.each(file.defs,function(name,d){ //TODO:put it into server
          if (d.condition){
//            console.log(d.condition)
            d.condition.forEach(function(c){
              var m=c.match(/\((\w+)\)/g)
              if(m)
                m.filter(i=>i!='ENABLED').forEach(function(def){
                  def=def.replace(/\(|\)| /g,'').trim();
                  (deps[def]=deps[def]||[]).push(name);
                })
            })
          }
        })
        $('.mct-tag').eq(0).text(file.tag)
        var href='card-'+file.file.name;
        var tab=addNewTab(file.file.name,href)
        $.each(file.sections,function(n,section){
          var id=(/adv/.test(file.file.name)?'adv-':'cfg-')+section
          var cnt=0;
          var sec=addNewSection(tab,id,section)
          $.each(file.list[section],function(n,define){
            cnt++;
            var d=_add(sec.find('template._define'))
            uiDefs[define]=d;
            var def=file.defs[define]
            opts[define]=file.defs[define];
            if (def.changed)
              d.addClass('bg-info')
            d.attr('define', define);
            d.find('label').eq(0).text(define.split('.')[0]).attr('title',def.line.trim())//.tooltip(def.line.length>24&&tooltip_large); //take 200ms
            var dis=d.find('.onoffswitch')
            var p=d.find('.mct-splitter');
            var val=d.find('.input-group');
            var sel=d.find('select');
            if (def.value == undefined)
              val.remove(),p.remove(),sel.remove();
            else{
              var dv=(def.changed&&def.changed.value||def.value);
              if (typeof def.select != "object")
              if (def.type=='select'){ //try to recover ugly json
                var json=def.select.trim();
                if (json[0]=='[')
                  json=json.replace(/'/g,'"'); // "
                else
                  json=json.replace(/'?([\w-]+)'?\:/g,'"$1":').replace(/\:\s*\'/g,':"').replace(/(\')\s*(,|\})/g,'"$2'); // '
                try{
                  def.select=JSON.parse(json);
                }catch(e){
                  console.log('detected ugly json:',def.select,json);
                  def.type='numeric';
                }
              }
              var inp=val.find('input');
              if (['boolean','select'].indexOf(def.type)>=0){
                inp=sel;
                val.remove();
                if (def.type=='boolean')
                  sel.val(eval(dv)?'true':'false');
                else{
                  sel.empty()
                  $.each(def.select,function(n,val){
                    var s,v=Array.isArray(def.select)?val:n;
                    sel.append(s=$('<option>').attr('value',v).text(val))
                    if(String(v)==dv)
                      s.attr('selected','')
                  })
                }
              }else{
                if (def.type=='string')
                  dv=dv.slice(1,-1)
                inp.val(dv);
                sel.remove();
              }
            }

            if ( !( def.changed && def.changed.disabled ) && !def.disabled && def.value != undefined)
              dis.remove(),p.remove();
            else{
              dis.find('input')
              .attr('checked',!getVal(def,'disabled'))
            }
            if (def.condition){
              var title='( '+def.condition.join(') && (')+' )';
              d.find('.col-sm-6').attr('title',title)//.tooltip(tooltip_large);
            }
            var b = d.find('button');
            if ( def.hint == undefined )
              b.eq(0).remove();
          }) //define

          sec.find('.card-header span.badge:eq(0)').text(cnt);
          updateChanged(sec);
          var btns=sec.find('.card-header button');
          btns.eq(1).on('click',function(){sec.find('.form-group').not('.bg-info').hide()})
          btns.eq(0).on('click',function(){sec.find('.form-group').show()})
          $('.config-files a[href$=Configuration]').tab('show');
        }) //section
        tab.tab.on('click', '.card-block button', function() {
          var btn = $(this), define = btn.parents('.form-group').attr('define');
          if (btn.hasClass('fa-info'))
            loadHint(define);
          if (btn.hasClass('fa-github'))
            window.opener("https://github.com/MarlinFirmware/Marlin/search?q=" + define + "&type=Issues&utf8=%E2%9C%93", "_blank");
          if (btn.find('.fa-times').length) {
            var inp = $(this).parent().siblings('input');
            var val = opts[define].value;
            if (opts[define].type == 'string')
              val = val.slice(1, -1);
            inp.val(val);
            processProp(define, 'value', opts[define].value)
          }
        })
        function processProp(define, name, val) {
          lastChanged = define + name;
          saveProp('/set/' + file.file.name + '/' + define + '/' + name + '/' + encodeURI(btoa(val)))
          .then(function() {
              setProp(define, name, val);
          });
        }
        tab.tab.on('change', '.card-block select,.card-block input[type=text]', function() {
          var btn = $(this), define = btn.parents('.form-group').attr('define');
          var val = btn.val();
          if (opts[define].type == 'string')
              val = '"' + val + '"';
          processProp(define, 'value', val);
        })
        tab.tab.on('change', '.card-block .onoffswitch input', function() {
          var btn = $(this), define = btn.parents('.form-group').attr('define');
          processProp(define, 'disabled', !$(this).prop('checked'));
        })

      }) //file
      $('body').scrollspy({ target: '#navbar-sections' })
      $('.config-files .nav-tabs a[data-toggle="tab"]').on('show.bs.tab', function (e) { //sync tab with nav
        var href=$(e.target).attr('href')
          $('#navbar-sections .tab-content .tab-pane').each(function(){
            $(this).toggleClass('active',$(this).attr('name')==href.slice(1));
          })
      })
      $('#navbar-sections').on('click',function(ev){
        var href=$(ev.target).attr('href')
        $('.config-files .nav-tabs a').each(function(){ $(this).attr('href')==href&&$(this).tab('show') });
      })
      $(window).on('hashchange', function(ev) { //set visible tab
        var href=location.hash;
        if (!$(href).is(':visible')){
          var id=$(href).parents('.tab-pane').attr('id');
          $('.config-files .nav-tabs a').each(function(){ $(this).attr('href')=='#'+id&&$(this).tab('show') });
          ev.preventDefault();
          setTimeout(function(){location.hash=href+' ';},500);
        }
      });
      return;
      var sideCountdown = 3;
      $(window).scroll($.debounce( 250, true, function(){
        sideCountdown && $('.navbar-side-right').toggleClass('toggled', true);
      }));
      $(window).scroll($.debounce( 1250, function(){
        sideCountdown && sideCountdown-- && $('.navbar-side-right').toggleClass('toggled', false);
      }));
    });
    function resolveDef(name){
      function scroll(ui){
        $('html, body').animate({
          scrollTop: ui.offset().top-100
        }, 1000);
      }
      var def=uiDefs[name];
      if (def){
        var pane=def.parents('.tab-pane')
        if(pane.is(':visible'))
          scroll(def);
        else{
          $("[href$="+pane.attr('id')+"]").tab('show');
          setTimeout(function(){scroll(def);},500);
        }
      }
      return def.length
    }
    gcodes.then(function(data){
      $.each(data.groups,function(n,section){
        var sec=addNewSection(tabGcodes,'gcode-'+section,section,'_group')
        $.each(data.list[section],function(n,tag){
//            cnt++;
          var d=_add(sec.find('template._gcode'))
          uiDefs[tag]=d;
          var gcode=optsG[tag]=data.tags[tag]; //
          d.find('label').text(gcode.title);
          d.find('.col-sm-2').text(gcode.codes.toString());
          var reqs=d.find('.col-sm-5')
            .attr('title',gcode.requires)
            .css('overflow-x','hidden')
          gcode.requires&&gcode.requires.forEach(function(req,i){
            if(i) reqs.append('<br/>')
            reqs.append($('<a>').attr('href','#')
              .text(req)
              .on('click',function(ev){
                if(!resolveDef(req))
                  ev.preventDefault();
              })
            );
          });
          d.on('click', 'button', function(){ loadGcode(tag)});
        });
      })
        $.each(data.tags,function(name,d){ //TODO:put it into server
          if (d.requires){
            if (/\(|\)/.test(d.requires)){
              console.log('cant parse',d.requires)
              toggleRed(name,d.requires);
            }else
            d.requires.forEach(function(c){
              (depsG[c]=depsG[c]||[]).push(name.trim())
            })
          }
        })
    });
    snippets.then(function(data){
      $.each(data,function(n,snip){
        var sec=addNewSection(tabSnippets,'gcode-'+snip.name,snip.title,'_snippet')
        $(sec).find('.form-horizontal').html(snip.data);
      })
    });
  // tag menu - change
  var tags = function(btn, ui, url){
    var t=ui.find('table tbody');
    ui.find('button.btn-primary').on('click',function(ev){
      var row = t.find('.table-success');
      if(row.length){
        var tag=row.find('td').eq(1).text().split(',')[0];
        console.log(tag);
        cmdReload($.ajax('/checkout/' + encodeURI(btoa(tag))),ui);
      }
    });
    ui.find('table tbody').on('click',function(ev){
      $(this).find('tr').removeClass('table-success');
      $(ev.target).parents('tr').addClass('table-success')
    });
    btn.on('click',function(){
      $.ajax(url)
      .fail(ajaxAlert)
      .then(function(data){
        data=data.sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:0;})
        t.empty();
        data.map(function(row){
          t.append($('<tr>').append($('<td>').text(row.date)).append($('<td>').text(row.tag)))
        })
        ui.modal();
      })
    })
    return this;
  }
  tags($('.mct-tags'),$('#mct-tags-modal'),'/tags');
  tags($('.mct-branches'),$('#mct-tags-modal'),'/branches');
  // tag menu - examples
  (function(btn,ui){
    var t=ui.find('table tbody');
    var hdr=ui.find('.modal-body>p span');
    ui.find('button.btn-primary').on('click',function(ev){
      var row = t.find('.table-success');
      if(row.length){
        var path=btoa(row.find('td').text());
        cmdReload($.ajax('/set-base/'+encodeURI(path)),ui);
      }
    });
    ui.find('table tbody').on('click',function(ev){
      $(this).find('tr').removeClass('table-success');
      $(ev.target).parents('tr').addClass('table-success')
    });
    btn.on('click',function(){
      $.ajax('/examples')
      .fail(ajaxAlert)
      .then(function(data){
        t.empty();
        hdr.text(data.current)
        config.base=data.current;
        data.list.map(function(row){
          t.append($('<tr>').append($('<td>').text(row)))
        })
        ui.modal();
      })
    })
  }($('.mct-examples'),$('#mct-examples-modal')));
  // tag menu - reset
  (function(btn,ui){
    var p=ui.find('p');
    btn.on('click',function(){
      $.ajax('/status')
      .fail(ajaxAlert)
      .then(function(data){
        p.empty();
        data.files.map(function(file){
          p.append(file.path+'<br>')
        })
        ui.modal();
      })
    })
    ui.find('button.btn-danger').on('click',function(ev){
        cmdReload($.ajax('/checkout-force'),ui);
    })
  }($('.mct-reset'),$('#mct-reset-modal')));
  // tag menu - update
  (function(btn){
    btn.on('click',function(){
      progress(0)(true)('50%');
      $.ajax('/fetch')
      .fail(ajaxAlert)
      .then(function(a){ progress('100%')(false); return a})
    })
  }($('.mct-update')));
  //tag menu - save
  (function(m){
    m.find('.btn-primary').on('click',function(){
      m.modal('hide');
      $.ajax('/save?message='+encodeURI(m.find('textarea').val()))
      .then(function(data){
        _add($('template._info'))
        .find('p').text('files: '+data.files.join(', ')+' stored to: '+data.to);
      })
    });
  }($('#mct-promptModal')));
  //tag menu - publish
  (function(m, btn) {
    var obj;
    btn.on('click', function() {
      $.ajax('/publish/TWFybGlu')
      .then(function(data) {
        obj = data;
        m.find('[name]').map(function() {
          var name = $(this).attr('name');
          if (name && name in data)
            $(this).val(data[name]);
        })
        m.modal('show');
      });
    });
    m.find('.btn-primary').on('click', function() {
      m.modal('hide');
      $.ajax('/publicate/', {method: 'POST', data: m.find('[name]')})
      .then(function(data) {
        window.opener('http://lt.rv.ua/mc/?h=' + location.host + '&s=' + obj.session, "_blank")
      })
    });
  }($('#mct-publishModal'), $('.mct-publish')));
  $('.mct-published').on('click', function() {
    window.opener('http://lt.rv.ua/mc/?h=' + location.host, "_blank");
  });
  // upload menu - restore
  (function(btn,m){
    var p=m.find('.modal-body p');
    var t=m.find('.modal-body textarea');
    var selected;
    m.find('.btn-primary')
    .on('click',function(){
      if (selected){
        var path=btoa(selected);
        cmdReload($.ajax('/restore/'+encodeURI(path)),m);
      }
    });
    m.find('.mct-download')
    .on('click', function() {
      if (selected) {
        var path = btoa(selected);
        window.opener('/zip/' + encodeURI(path), '_blank');
      }
    });
    btn.on('click',function(){
      $.ajax('/saved')
      .then(function(data){
        p.treeview({
          data:data.tree,
          expandIcon:'fa fa-plus',
          collapseIcon:'fa fa-minus',
        })
        .on('nodeSelected',function(ev,node){
          var msg='';
          selected='';
          if (data.info[node.path]){
            selected=node.path;
            msg=data.info[node.path].message
          }
          t.val(msg);
        })
        m.modal();
      })
    })
  }($('.mct-restore'),$('#mct-restoreModal')));
  // consoles menu
  var wins = {};
  function openWin(url, target) {
    (wins[target] || ( wins[target] = window.open(url, target))).focus();
  }
  $('.mct-consoles').on('click',function(){ openWin('consoles.html', 'consoles') });
  $('.mct-editor').on('click',function(){ openWin('editor', 'editor') });
  // ports dropdown menu management
  (function(ports){
    function createPort(p){
      ports.append(`<a class="dropdown-item" href="#">${p.comName}</a>`)
    }
    function removePort(p){
      ports.find('a').filter(function(i,el){ return $(el).text()==p.comName}).remove()
      if (!ports.find('.bg-info').length)
        ports.find('a').eq(0).addClass('bg-info')
    }
      var source = new EventSource("/ports");
      source.addEventListener('list', function(event) {
        var list= JSON.parse(event.data);
        ports.find('.dropdown-divider').nextAll().remove();
        list.forEach(function(p){
          createPort(p)
        });
      });
      source.addEventListener('error', function(event) {
        $('.mct-consoles,.mct-pio-ports').attr('disabled','')
      });
      source.addEventListener('open', function(event) {
        $('.mct-consoles,.mct-pio-ports').removeAttr('disabled')
      });
      source.addEventListener('reload', function(event) {
        location.reload()
      });
      source.addEventListener('created', function(event) {
        var port= JSON.parse(event.data);
        createPort(port);
      });
      source.addEventListener('deleted', function(event) {
        var port= JSON.parse(event.data);
        removePort(port);
      });
      source.addEventListener('set', function(event) {
        var data= JSON.parse(event.data);
        if (lastChanged!==data.name+data.prop){
          var def=opts[data.name],val=atob(decodeURI(data.value)).toString(),ui=uiDefs[data.name];
          if (data.prop=='disabled'){
            val=val=='true';
            ui.find('.onoffswitch input').prop('checked',!val)
          }else
          if (['boolean','select'].indexOf(def.type)>=0){
            ui.find('select').val(val)
          }else{
            var dv=val;
            if (def.type=='string')
              dv=dv.slice(1,-1)
            ui.find('input[type=text]').val(dv);
          }
          setProp(data.name,data.prop,val);
          var p=$('#mct-log-modal .modal-body p');
          var badge=$('.mct-info span')
          badge.text(parseInt(badge.text())+1).removeAttr('hidden')
          p.append('<br>' + (new Date()).toLocaleString() + '(' + data.ip + '): ' + data.name + ' ' + data.prop + '=' + val);
        }
        lastChanged='';
      });
  }($('.mct-ports')));
  // info menu
  (function(btn){
    var base=$('#mct-log-modal');
    var p=base.find('.modal-body p');
    p.append(`Current directory is: <strong>${config.root}</strong><br>Current base files choosen from: <strong>${config.base}</strong><br>changed options from other hosts:`)
    btn.on('click',function(){
      var badge=$('.mct-info span')
      badge.text(0).attr('hidden','');
      base.modal();
    })
  }($('.mct-info')));
  // compile and flash buttons
  (function(){
    var r=$('#mct-pio-modal');
    var p=r.find('.form-group pre');
    var b=r.find('.modal-footer button');
    var proc={}
    proc.init=function(){ p.text(''); r.modal();}
    proc.info=function(){
      _add($('template._alert'))
      .find('p').html(`to install PlatformIO use guide from
<strong><a target="_blank" href="http://docs.platformio.org/en/latest/installation.html">Official site</a></strong>
<br>Linux/Mac hint:  <code>sudo apt install python-pip</code> <code>sudo pip install -U platformio</code>`)
    }
    proc.log=function(text){ p.append(text); p.prop('scrollTop',p.prop('scrollHeight')); }
    var cmd;
    $('.mct-pio-compile, .mct-pio-flash, .mct-pio-ports')
    .toggleClass('disabled',!config.pio)
    .attr(!config.pio?'title':'null','PlatformIO not installed')
    .eq(0).on('click',function(){
        cmd=stream_cmd('/pio/'+$('.mct-pio-env .bg-info').text().trim(),proc)()
    }).end()
    .eq(1).on('click',function(){
        cmd=stream_cmd('/pio/'+$('.mct-pio-env .bg-info').text().trim()+'/'+encodeURI(btoa($('.mct-ports .bg-info').text().trim())),proc)()
    }).end()
    r.on('hide.bs.modal',function(){
      cmd.abort();
    })
    b.on('click',function(){
      cmd.abort();
    })
    $.each(config.env||[],function(i,name){
      $('.mct-pio-env').append(`<a class="dropdown-item" href="#">${name}</a>`)
    })
    $('.mct-pio-env,.mct-ports').on('click',function(ev){
      if ($(ev.target).hasClass('dropdown-item'))
        $(ev.target).addClass('bg-info').siblings().removeClass('bg-info')
    })
  }());
  // issue menu
  (function(){
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
            text+='\n//file '+file.file.base+' Release:'+file.tag+'\n'+f;
        })
        var url=encodeURI('https://github.com/MarlinFirmware/Marlin/issues/new?title=&body='+text).replace(/\#/g,'%23');
        window.opener(url)
      })
    })
  }());
  // init conditions
  (function(){
    gcodes.then(function(gcodes){
      defs.then(function(data){
        var failG=$.extend(true,{},depsG)
        data.forEach(function(file){
          $.each(file.defs,function(name,ob){
            checkCondition(name);
            //updateConditions(name);
            delete failG[name]
          })
        })
        $.each(gcodes.tags,function(name,ob){
            checkConditionG(name);
        })
        $.each(failG,function(name,data){
          data.forEach(function(gcode){
            toggleRed(gcode,name)
          });
        })
      })
    })
  }());
    var state=$('.mct-changed input')
    .on('change',function(){
      var defs=$('.tab-pane[id*=card-C] .form-group')
      if ($(this).prop('checked'))
        defs.not('.bg-info').hide()
      else
        defs.show();
    })
})

function _add(tmpl){
    tmpl.parent().append(tmpl.prop('content').cloneNode(true))
    return tmpl.parent().children().last()
}
function createPort(p){
    var uiPort=_add($('template.port'));
    var port=p.comName.match(/([\w\-\.]+)$/)[1]
    with(uiPort.find('td')){
      var obSpeed=find('select')
      eq(0).text(p.comName)
      eq(1).text(p.status)
      with(eq(2)){
        $.each([9600,14400,19200,28800,38400,56000,57600,115200,128000,153600,230400,256000,460800,921600],function(i,n){
          obSpeed.append($('<option>').attr('value',n).text(n))
        })
        var speed=store[port]&&store[port].speed||p.speed||115200;
        obSpeed.val(speed).on('change',function(){
          updateStore(port,'speed',$(this).val());
        })
      }
      with(eq(3).find('button')){
        eq(0).on('click',function(){createConsole(port,obSpeed.val(),uiPort);})
        eq(1).on('click',function(){ removeTab(port); $.ajax('/port-close/'+port) })
      }
    }
}
function removePort(p){
  $('table tr').filter(function(i,el){ return $(el).find('td').eq(0).text()==p.comName}).remove()
}
function changePort(p){
  $('table tr').filter(function(i,el){ return $(el).find('td').eq(0).text()==p.comName})
  .find('td')
  .eq(1).text(p.status).attr('title','').end()
  .eq(2).find('a.btn').text(p.speed)
}
function removeTab(name){
  $('#'+name).remove();
  $('a[href$='+name+']').remove();
}
function createTab(name,url){
    var tab,tmpl;
    if(!$('#'+name).length){
      _add($('template.port-body'))
      .attr('id',name);
      tmpl=_add($('template.port-tab'));
      tab=tmpl.find('a')
      .text(name).attr('href','#'+name)
    }else
      tab=$('a[href$='+name+']');
    tab.tab('show')
    return tmpl&&$('#'+name);
}

function createConsole(port,speed,row){
  $.ajax('/port/'+port+'/'+speed).then(function(url){
    var tab=createTab(port);
    if (tab)
      initConsole(tab,url,port);
  }).fail(function(msg){
    removeTab(port);
    console.error(msg);
    row.find('td').eq(1).text('busy').attr('title',msg.responseText)
  })
}
function initConsole(tab,url,port){
    function add(msg){
      var log=tab.find('textarea');
      var scroll=tab.find('input[type=checkbox]');
      log.append(msg)
      if (scroll.prop('checked'))
        log.prop('scrollTop',log.prop('scrollHeight'));
    }
    var s=tab.find('input[type=text]');
    var aTags = store.gcodes||[];
    s.autocomplete({
//      minLength:1,
      autoFocus: true,
      position: { my: "left bottom", at: "left top", collision: "flip" },
      source : aTags,
    });
    s.on('click',function(){
      s.autocomplete('search','');
    })
    $('.ui-autocomplete-input').on('keydown',function(ev){
      if (ev.keyCode==46){
        var it=aTags.indexOf($('.ui-autocomplete .ui-state-active').text());
        if (it>=0){
          aTags.splice(it,1)
          updateStore(0,'gcodes',aTags);
        }
      }
    })
    var eol=tab.find('select');
    eol.val(store[port]&&store[port].eol)
    eol.on('change',function(){
      updateStore(port,'eol',$(this).val())
    })
    var socket = io.connect({path:url});
    socket.on('connect', function(data) {
      //socket.emit('message', 'Hello World from client');
    });
    socket.on('message',function(msg){
      add(msg);
    })
    socket.on('disconnect',function(msg){
      add('\n[closed]')
      socket.close();
    })
    function send(){
      if(aTags.indexOf(s.val())<0){
        aTags.push(s.val());
        updateStore(0,'gcodes',aTags);
      }
      socket.emit('message',s.val()+eol.val().replace(/r/,'\r').replace(/n/,'\n'));
      s.val('');
    }
    tab.find('button').on('click',send)
    s.keypress(function (e) {
      if (e.which == 13) {
        send();
        return false;
      }
    });
}
function updateStore(port,name,val){
  if (localStorage){
    if (port)
      (store[port]=store[port]||{})[name]=val;
    else
      store[name]=val;
    localStorage.setItem("consoles",JSON.stringify(store));
  }
}
var store={};
$(function(){
  if (localStorage)
    try{
      var val=localStorage.getItem("consoles");
      if (val)
        store=JSON.parse(val);
    }catch(e){}
      var source = new EventSource("/ports");
      source.addEventListener('list', function(event) {
        var list= JSON.parse(event.data);
        $('template.port').siblings().remove();
        list.forEach(function(p){
          createPort(p)
        });
      });
      source.addEventListener('created', function(event) {
        var port= JSON.parse(event.data);
        createPort(port);
      });
      source.addEventListener('deleted', function(event) {
        var port= JSON.parse(event.data);
        removePort(port);
      });
      source.addEventListener('opened', function(event) {
        var port= JSON.parse(event.data);
        changePort(port);
      });
      source.addEventListener('closed', function(event) {
        var port= JSON.parse(event.data);
        changePort(port);
      });
});

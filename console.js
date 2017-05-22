var EventEmitter = require('events');
var sio = require('socket.io');
var fs = require('fs');
var path = require('path');
var SerialPort = require('serialport');
var ports={};
var monitor = new EventEmitter();
exports.monitor=monitor;
var open=(http,p,speed)=>new Promise((done,fail)=>{
    var root = '/dev/'+p;
    var port = new SerialPort(root, {
      autoOpen: false,
      parser0: SerialPort.parsers.readline('\n'),
      baudRate: speed,
    });
    port.open(function (err) {
      if (err) {
        console.log('Error opening port: ', err.message);
        return fail(err.message);
      }
      var url='/console/'+p;
      var io= new sio(http,{path:url});//,openOptions:{rtscts:true}});
      ports[p]={port:port,name:root,speed:speed,url:url,io:io};
      monitor.emit('opened',{comName:root,speed:speed,status:'opened'})
      io.on('connection', function(socket){
        console.log('new port user connected');
        socket.on('message', function(msg){
          //console.log('message ',msg);
          port.write(msg, function(err) {
            if (err)
              return console.log('Error on write: ', err.message);
            //console.log('message written');
          });
        });
        port.on('data', function(msg){
          socket.emit('message',msg.toString());
        })
        port.on('close', function(err){
          console.log('[PORT] closes soccket')
          socket.disconnect();
        })
      });
      done(url);
    });
    port.on('close', function(err){
      console.log('[PORT] closed')
      monitor.emit('closed',{comName:root,status:'closed'});
      if (ports[p])
        delete ports[p]
    })
    port.on('error', function(err) {
      console.log('Error: ', err.message);
      fail(err);
    })
})
var close=(p)=>new Promise((done,fail)=>{
  var m=p.match(/(\w+)$/)
  if (m)
    p=m[1];
  if (!ports[p] ) return done(p);
  var root=ports[p].name;
  ports[p].port.close(function(err){
    if(err)return fail(err);
    done(p);
  });
})

module.exports.open=open;
module.exports.close=close;
module.exports.init=(http,p,speed)=>{
    speed=parseInt(speed||115200);
    if ( ports[p] ){
      if( ports[p].speed == speed )
        return Promise.resolve(ports[p].url);
      else
        return close(p).then(a=>open(http,p,speed))
    }else
      return open(http,p,speed)
}
exports.list=()=>new Promise((done,fail)=>{
  SerialPort.list(function (err, ps){
    if (err) return fail(err);
    done(ps.filter(i=>i.manufacturer).map(i=>{
      var m;
      i.status='closed';
      if (m=i.comName.match(/(\w+)$/)){
        //console.log(ports[m[1]],m[1])
        if(ports[m[1]]){
          i.status='opened';
          i.speed=ports[m[1]].speed;
        }
      }
      return i;
    }));
  });
});
exports.changes=()=>new Promise((done,fail)=>{
  var root='/dev'
  fs.stat(root,function(err,stats){
    if (err)
      return fail('no '+root);
    if (!stats.isDirectory())
      return fail('not directory '+root);
    else{
//      var monitor = new EventEmitter();
      fs.watch(root, {encoding0: 'buffer'}, (eventType, filename) => {
        var p=path.join(root,filename);
        if (eventType=='rename')
          fs.stat(p,function(err,stats){
            if(err) return monitor.emit('deleted',{comName:err.path,err:err});
            monitor.emit('created',{comName:p,stats:stats});
          })
      })
      done(monitor);
    }
  })
})

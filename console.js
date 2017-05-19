var sio = require('socket.io');
var SerialPort = require('serialport');
var ports={};
module.exports.init=(http,p)=>new Promise((done,fail)=>{
    if ( ports[p] ){
      return done(ports[p].url);
    }
    var port = new SerialPort('/dev/'+p, { autoOpen: false , parser0: SerialPort.parsers.readline('\n')});
    port.open(function (err) {
      if (err) {
        console.log('Error opening port: ', err.message);
        return fail(err.message);
      }
      var url='/console/'+p;
      var io= sio(http,{path:url});
      ports[p]={port:port,url:url,io:io};
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
          socket.close();
        })
      });
      done(url);
    });
    port.on('close', function(err){
      console.log('[PORT] closed')
      if (ports[p])
        delete ports[p]
    })
    port.on('error', function(err) {
      console.log('Error: ', err.message);
      fail(err);
    })
})

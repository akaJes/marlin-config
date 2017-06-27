var sio = require('socket.io');
var ss = require('socket.io-stream');
var path = require('path');
exports.init=(http)=>{
  var sockets=[];
  var io=new sio(http,{path:'/web-cam'})
  var iov=new sio(http,{path:'/web-view'})
  iov.on('connection', function(socket) {
    console.log('iov connected')
    sockets.push(socket);
  });
if(0)
  io.on('connection', function(socket) {
    console.log('io connected')
    ss(socket).on('stream', function(stream, data) {
      sockets.forEach(function(socket){
        ss(socket).emit('view',stream);
      });
    });
  });
}
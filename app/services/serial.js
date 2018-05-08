const router = module.exports = require('express').Router();

const store = require('../store');
const serial = require('../console');

var SSEports = [];
var server;

function SSEsend(event, data) {
  SSEports.forEach(function(res) {
    res.write("event: " + event + "\n");
    res.write("data: " + JSON.stringify(data) + "\n\n");
  });
}

function serial_init(_server) {
  server = _server;
  return serial.changesPoll().then(monitor => {
    monitor.on("created", function (f, stat) {
      SSEsend('created',f)
    })
    monitor.on("deleted", function (f, stat) {
      SSEsend('deleted',f)
    })
    monitor.on("opened", function (f, stat) {
      SSEsend('opened',f)
    })
    monitor.on("closed", function (f, stat) {
      SSEsend('closed',f)
    })
  })
  .catch(a => console.error(a));
}

store.mods.serial.ctor = serial_init;
store.mods.serial.close = serial.close;

router.get('/ports', function (req, res) {
  req.socket.setTimeout(Number.MAX_SAFE_INTEGER);
  console.log('SSE conected');
  res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
  });
  SSEports.push(res);
  serial.list().then(a=>SSEsend('list',a));
  console.log('list sent');
  req.on('close',function(){
    var i=SSEports.indexOf(res);
    if (i>=0)
      SSEports.splice(i,1);
    console.log('SSE removed');
  })
});

router.get('/port/:port/:speed', function (req, res) {
  serial.init(server, req.params.port, req.params.speed)
  .then(data=>{
    res.send(data);
  })
  .catch(a=>res.status(403).send(a))
});

router.get('/port-close/:port', function (req, res) {
  serial.close(req.params.port)
  .then(data=>{
    res.send(data);
  })
  .catch(a=>res.status(403).send(a))
});

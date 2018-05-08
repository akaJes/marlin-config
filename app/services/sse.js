const router = module.exports = require('express').Router();
const store = require('../store');

var clients = [];

function SSEsend(event, data) {
  clients.forEach(function(res) {
    res.write("event: " + event + "\n");
    res.write("data: " + JSON.stringify(data) + "\n\n");
  });
}

store.mods.sse.send = SSEsend;

router.get('/ports', function (req, res) {
  req.socket.setTimeout(Number.MAX_SAFE_INTEGER);
  console.log('SSE conected');
  res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
  });
  clients.push(res);
  if(store.mods.serial) {
    store.mods.serial.list().then(a => SSEsend('list', a));
    console.log('list sent');
  }
  req.on('close',function(){
    var i = clients.indexOf(res);
    if (i >= 0)
      clients.splice(i,1);
    console.log('SSE removed');
  })
});

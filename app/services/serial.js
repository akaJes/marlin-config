const router = module.exports = require('express').Router();
const store = require('../store');
const serial = require('../console');

var server;

function serial_init(_server) {
  server = _server;
  return serial.changesPoll().then(monitor => {
    monitor.on("created", function (f, stat) {
      store.mods.sse.send('created', f)
    })
    monitor.on("deleted", function (f, stat) {
      store.mods.sse.send('deleted', f)
    })
    monitor.on("opened", function (f, stat) {
      store.mods.sse.send('opened', f)
    })
    monitor.on("closed", function (f, stat) {
      store.mods.sse.send('closed', f)
    })
  })
  .catch(a => console.error(a));
}

store.mods.serial.ctor = serial_init;
store.mods.serial.close = serial.close;
store.mods.serial.list = serial.list;

router.get('/port/:port/:speed', function (req, res) {
  serial.init(server, req.params.port, req.params.speed)
  .then(data => res.send(data))
  .catch(a=>res.status(403).send(a))
});

router.get('/port-close/:port', function (req, res) {
  serial.close(req.params.port)
  .then(data => res.send(data))
  .catch(a=>res.status(403).send(a))
});

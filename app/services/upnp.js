const router = module.exports = require('express').Router();

const os = require('os');
const natUpnp = require('nat-upnp');
const promisify = require('../helpers').promisify;
const vars = require('../store').vars;

var natClient;

function init() {
  if (!natClient) {
    natClient = natUpnp.createClient();
    natClient.timeout = 10*1000;
  }
}
/* UPNP */

function getIP() {
  var ifaces = os.networkInterfaces();
  return Object.keys(ifaces).reduce((p, c) =>
    p.concat(ifaces[c].filter(i => !i.internal && 'IPv4' == i.family).map(i => i.address)), []);
}

router.get('/open', function (req, res) {
  init();
  promisify('portMapping', natClient)({
    public: vars.httpPort,
    private: vars.httpPort,
    ttl: 0,
    description: 'Marlin-conf public port'
  })
  .then(a => promisify('externalIp', natClient)())
  .then(ip => res.send({ip: ip, port: vars.httpPort}))
  .catch(e => res.status(403).send(e));
})

router.get('/local', function (req, res) {
  res.send({ip: getIP()[0], port: vars.httpPort, https: vars.httpsPort});
})

router.get('/check', function (req, res) {
  init();
  Promise.all([
    promisify('getMappings', natClient)(),
    promisify('externalIp', natClient)()
  ])
  .then(p => p[0].filter(i => i.public.port == vars.httpPort).map(i => ({ip: p[1], port: i.public.port})))
  .then(data => (data.length && console.log('Opened external access at http://' + data[0].ip + ':' + data[0].port, '!!!'), data))
  .then(data => res.send(data))
  .catch(e => res.status(403).send(e));
})

router.get('/close', function (req, res) {
  init();
  promisify('portUnmapping', natClient)({
    public: vars.httpPort,
  })
  .then(data => res.send())
  .catch(e => res.status(403).send(e));
})

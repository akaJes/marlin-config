const router = module.exports = require('express').Router();
const git = require('../git-tool');
const store = require('../store');
const atob = require('../helpers').atob;

router.get('/tags', function (req, res) {
  git.Tags()
  .then(data => res.send(data))
  .catch(a => res.status(403).send(a))
});

router.get('/branches', function (req, res) {
  git.Branches()
  .then(data => res.send(data))
  .catch(a => res.status(403).send(a))
});

router.get('/checkout/:branch', function (req, res) {
  return Promise.resolve(atob(decodeURI(req.params.branch)).toString())
  .then(a=>(console.log(a),a))
  .then(git.Checkout)
  .then(data => res.send(data))
  .catch(a => res.status(403).send(a))
});

router.get('/status', function (req, res) {
  git.Status()
  .then(a => res.send(a))
  .catch(a => res.status(403).send(a))
});

router.get('/checkout-force', function (req, res) {
  var cp = () => git.root()
    .then(root => Promise.all(
      ['Configuration.h', 'Configuration_adv.h', '_Bootscreen.h']
      .map(f=>new Promise((done,fail)=>
          fs.createReadStream(path.join(root, store.vars.baseCfg, f)).on('error', fail)
          .pipe(fs.createWriteStream(path.join(root, 'Marlin', f)).on('finish', done))
        ).catch(e => 'not found')
      )
    ))
  var rm = () =>
    seek4File('_Bootscreen.h', [path.join('Marlin', 'src', 'config'), 'Marlin'])
    .then(file => file && promisify(fs.unlink)(file))
    .catch(a=>a);

  git.Checkout('--force')
  .then(rm)
  .then(a => store.vars.baseCfg == 'Marlin' ? a : cp())
  .then(a => res.send(a))
  .catch(e => res.status(403).send(e))
});

router.get('/fetch', function (req, res) {
  git.Fetch()
  .then(a => res.end(JSON.stringify(a)))
  .catch(e => res.status(403).send(e))
});

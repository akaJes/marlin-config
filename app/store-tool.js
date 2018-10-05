const fs = require('fs');
const path = require('path');

const { promisify } = require('./helpers');
const git = require('./git-tool');
const store = require('./store');

exports.write = () =>
  git.root()
  .then(root => promisify(fs.writeFile)(path.join(root, store.config.store, 'config.json'), JSON.stringify({state: store.state}, 0, 2)))

exports.read = () =>
  git.root()
  .then(root => promisify(fs.readFile)(path.join(root, store.config.store, 'config.json'), 'utf8'))
  .then(data => JSON.parse(data))
.then(a=>(console.log('read', a),a))
  .then(data => Object.assign(store, data))
//  .catch(e => e)

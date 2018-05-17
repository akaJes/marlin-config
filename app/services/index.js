const router = module.exports = require('express').Router();
const store = require('../store');

router.use('/', require('./sse'));
if (store.mods.editor)
  router.use('/s/editor', require('./editor'));
if (store.mods.upnp)
  router.use('/upnp', require('./upnp'));
if (store.mods.serial)
  router.use('/', require('./serial'));
router.use('/', require('./git'));
router.use('/', require('./snippets'));
router.use('/', require('./pub'));
router.use('/', require('./store'));

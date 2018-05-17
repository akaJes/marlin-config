exports.vars = {
  httpPort: 3000,
  httpsPort: 3002,
  baseCfg: 'Marlin',
};

exports.config = {
  store: '.mct.bak',
};

exports.mods = {
  sse: {},
  editor: {
    root(req) {}, //replace it!
    name(req) { return 'marlin-conf' },
  },
  serial: {}, // comment for disabling
  upnp: {}, // comment for disabling
};

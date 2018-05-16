exports.vars = {
  httpPort: 3000,
  httpsPort: 3002,
};

exports.config = {
  store: '.mct.bak',
};

exports.mods = {
  editor: {
    root(req) {}, //replace it!
    name(req) { return 'marlin-conf' },
  },
  serial: {}, // comment for disabling
  upnp: {}, // comment for disabling
};

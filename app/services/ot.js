const fs = require('fs');
const path = require('path');
const sio = require('socket.io');
const ot = require('ot');
const store = require('../store').mods.editor;
const promisify = require('../helpers').promisify;

var ns = {};
const getFile = file => store.root().then(root => promisify(fs.readFile)(path.join(root, file)))
const setFile = (file, data) => store.root().then(root => promisify(fs.writeFile)(path.join(root, file), data))

exports.init = (server, url) => {
  const io = new sio(server, {path: url});
  io.on('connection', function(socket) {
    socket.on('ns', function (docId) {
      if (ns[docId])
        socket.emit('ns', docId);
      else {
        getFile(docId)
        .then(text => {
          var doc = ns[docId] = new ot.EditorSocketIOServer(text.toString(), 0, docId)
          socket.emit('ns', docId);
          io.of(docId)
          .on('connection', function(socket) {
            function clients(mode) {
              socket.broadcast.in(docId).emit('clients', {clients: doc.users, mode: mode});
            }
            doc.getClient(socket.id);
            doc.addClient(socket);
            clients('enter');
            socket.in(docId)
            .on('disconnect', function() {
              console.log('disconnect');
              delete doc.users[socket.id];
              clients('leave');
            })
            .on('name', function (name) {
              doc.setName(socket, name);
              console.log('set name')
              clients('name');
            })
            .on('operation', function (name) {
              console.log('saving...');
              setFile(docId, doc.document);
            });
          })
        })
      }
    });
  });
}
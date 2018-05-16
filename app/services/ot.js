const fs = require('fs');
const path = require('path');
const sio = require('socket.io');
const ot = require('ot');
const store = require('../store').mods.editor;
const promisify = require('../helpers').promisify;

var ns = {};
const getFile = file => store.root().then(root => promisify(fs.readFile)(path.join(root, file)))

exports.init = (server, url) => {
  const io = new sio(server, {path: url});
  io.on('connection', function(socket) {
    socket.on('ns', function (docId) {
      if (ns[docId])
        socket.emit('ns', docId);
      else {
        getFile(docId)
        .then(text => {
          var doc = docId;
          ns[docId] = new ot.EditorSocketIOServer(text.toString(), 0, doc)
          socket.emit('ns', docId);
          io.of(docId)
          .on('connection', function(socket) {
            ns[docId].addClient(socket);
            socket.broadcast.in(doc).emit('enter');
/*
            socket.in(doc).on('disconnect', function() {
              console.log('delete instance')
              delete ns[docId];
            }) */
            socket.in(doc).on('name', function (name) {
              ns[docId].setName(socket, name);
              console.log('set name')
            });
          })
        })
      }
    });
  });
}
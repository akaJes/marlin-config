#! /usr/bin/env node
var SerialPort = require('serialport');
var fs = require('fs')
var path = require('path')

SerialPort.list(function (err, ports) {
  ports.forEach(function(port) {
    if (!port.manufacturer) return;
    console.log(port.comName);
    console.log(port.pnpId);
    console.log(port.manufacturer);
  });
});
var root='/dev'
fs.watch(root, {encoding0: 'buffer'}, (eventType, filename) => {
//  myEmitter = new MyEmitter();
  if (eventType=='rename')
    fs.stat(path.join(root,filename),function(err,stats){
      if(err) console.log(err);
      else
        console.log(stats)
    })
  //if (filename)
  //  console.log(filename,eventType);
    // Prints: <Buffer ...>
});

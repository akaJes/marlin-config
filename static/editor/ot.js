ace.define("ot", function(require, exports, module) {
"use strict";
    var Range = ace.require("ace/range").Range
    if (typeof diff_match_patch != 'function') {
      var error = "preload https://github.com/google/diff-match-patch";
      console.error(error);
      throw new Error(error);
    }
    var dmp = new diff_match_patch();
    dmp.Diff_Timeout = 1;
    dmp.Diff_EditCost = 10;
    var dmpMode = 0; //TODO

    function OT(manager, state) {
        var socket = this.socket = io.connect({path: '/ws'});
        this.setName = function(name) {
          for(var s in manager) {
            manager[s].socket.emit('name', name)
          }
        }
        socket.on('ns', function(dir) {
          var ss = manager[dir];
          var s = ss.socket = io.connect(dir, {path: '/ws'});
          var cli = ss.ot = new ot.Client(0);
          var session = ss.session;
          ss.dc = debounce(scan, 1000);
		  function onChange(obj) {
            state('typing...')
            ss.dc(ss);
            var doc = session.doc;
            var start = doc.positionToIndex(obj.start);
            var end = doc.positionToIndex(obj.end);
            remoteCaretsUpdate(session, end, obj.action == 'remove' ? start - end : end - start)
          }
          session.on('change', onChange);
          function getOtSel(range) {
            var start = session.doc.positionToIndex(range.start);
            var end = session.doc.positionToIndex(range.end);
            return ot.Selection.fromJSON([{anchor: start, head: end}]);
          }
          s.on('doc', function (ob) {
            session.otDoc = ob.str;
            session.setValue(ob.str);
            session.remoteNames = ob.clients;
            cli.revision = ob.revision; // hack
            session.getSelection().on('changeSelection', function(e, sel){
              if (!sel.isEmpty()) {
                var range = sel.getRange();
                s.emit('selection', getOtSel(range));
              }
            });
            session.getSelection().on('changeCursor', function(e, sel){
              var range = sel.getRange();
              s.emit('selection', getOtSel(range));
            });
          });
          cli.sendOperation = function (revision, operation) {
            state('sending...')
            var range = session.getSelection().getRange();
            s.emit('operation', revision, operation, getOtSel(range))
          }
          s.on('clients', function(ob) {
            console.log(ob)
            session.remoteNames = ob.clients;
            if (ob.mode == "enter") {
              var audio = new Audio('to-the-point.mp3');
              audio.play();
            }
          });
          s.on('ack', function () {
            state('stored')
            s.emit('ack');
            cli.serverAck();
          });
          s.on('selection', function (clientId, selection) {
            var range= {start: selection.ranges[0].anchor, end: selection.ranges[0].head};
            setCarret(clientId, range);
          });
          function setCarret(origin, range) {
            var marker = session.remoteCarets[origin]
            if (marker) {
              marker.cursors = [range]; // save the cursors as indexes
              session._signal('changeFrontMarker');
            } else {
              marker = session.remoteCarets[origin] = new Marker(session, origin, range);
              session.addDynamicMarker(marker, true);
              // call marker.session.removeMarker(marker.id) to remove it
              // call marker.redraw after changing one of cursors
            }
            marker.name = session.remoteNames[origin].name;
            marker.refresh();
          }
          s.on('operation', function (clientId, operation, selection) {
            scan(ss); //apply undebounced
            var operation = ot.TextOperation.fromJSON(operation);
            cli.applyServer(operation);
            var range= {start: selection.ranges[0].anchor, end: selection.ranges[0].head};
            setCarret(clientId, range);
          });
          cli.applyOperation = function(operation) {
              var index = 0;
              operation.ops.map(function(op) {
                if (ot.TextOperation.isRetain(op)) {
                  index += op;
                } else if (ot.TextOperation.isInsert(op)) {
                  var pos = session.doc.indexToPosition(index);
                  session.doc.insert(pos, op)
                  index += op.length;
                } else if (ot.TextOperation.isDelete(op)) {
                  var from = session.doc.indexToPosition(index);
                  var to = session.doc.indexToPosition(index - op);
                  session.doc.remove(new Range(from.row, from.column, to.row, to.column))
                }
              });
              session.otDoc = session.getValue();
          }
        }) //ns
        function remoteCaretsUpdate(session, index, length){
          var change = false;
          for (origin in session.remoteCarets) {
            session.remoteCarets[origin].cursors.filter(function(cursor) {
                if (cursor.start >= index){
                    cursor.start += length;
                    change = true;
                }
                if (cursor.end >= index){
                    cursor.end += length;
                    change = true;
                }
            })
          }
          change && session._signal('changeFrontMarker');
        };
        this.init = function (dir) {
          socket.emit('ns', dir);
          var session = manager[dir].session;
          session.remoteCarets = {};
          session.remoteNames = {};
          session.otDoc = session.getValue();
        }
        this.shut = function (dir) {
          var ss = manager[dir];
          ss.socket.close();
          delete ss.ot;
        }
        function scan(ss) {
          var session = ss.session;
          if (session.otDoc && session.getValue()) {
            var d = dmp.diff_main(session.otDoc, session.getValue());
            //dmp.diff_cleanupSemantic(d); //semantic //TODO: add mode
            dmp.diff_cleanupEfficiency(d); //efficiency
            if (d.length == 1) return;
            var op  = new ot.TextOperation();
          d.filter(function(i) { return i[1].length; })
          .map(function(i, n, o) {
            if (!i[0]) {
              op = op.retain(i[1].length)
            }else
            if (i[0] == -1) {
              op = op.delete(i[1].length)
            }else
            if (i[0] == 1) {
              op = op.insert(i[1])
            }
          }); //d
            ss.ot.applyClient(op);
            session.otDoc = session.getValue();
          }
        }
    }
    return OT
});

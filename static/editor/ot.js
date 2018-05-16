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

    function OT(editor, ses) {
        this.editor = editor;
		var self = this;
		var dc = debounce(scan, 1000, this);
//        var skipChange;
		this.onChange = function(obj, editor) {
//          if(!skipChange)
            dc(); //TODO: debounce per session
          if(1) {
            var start = editor.session.doc.positionToIndex(obj.start);
            var end = editor.session.doc.positionToIndex(obj.end);
            remoteCaretsUpdate(end, obj.action == 'remove' ? start - end: end - start )
          }
//          skipChange = null;
		}
		this.updateAnnotations = function(session) {
		  self.editor.renderer.setAnnotations((session.$annotations || []).concat(session.diffAnnotations || []))
        }
		this.onChangeAnnotation = function(obj, session) {
          self.updateAnnotations(session)
		}
        var socket = this.socket = io.connect({path: '/ws'});
        this.setName = function(name) {
          ses.map(function(i) { i.socket.emit('name', name)});
        }
        socket.on('ns', function(dir) {
          var s = io.connect(dir, {path: '/ws'});
          var ss = ses.filter(function(i) { return i.path == dir; });
          ss[0].socket = s;
          var cli = ss[0].ot = new ot.Client(0);
          function getOtSel(range) {
            var start = editor.session.doc.positionToIndex(range.start);
            var end = editor.session.doc.positionToIndex(range.end);
            return ot.Selection.fromJSON([{anchor: start, head: end}]);
          }
          s.on('doc', function (ob) {
            var session = ss[0].session;
            session.otDoc = ob.str;
            session.setValue(ob.str);
            var e = editor;
            cli.revision = ob.revision; // hack
            session.getSelection().on('changeSelection', function(e, sel){
              if (!sel.isEmpty()) {
                var range = sel.getRange();
                s.emit('selection', getOtSel(range));//  getCursorPosition() getSelectionRange()
              }
            });
            session.getSelection().on('changeCursor', function(e, sel){
              var range = sel.getRange();
              s.emit('selection', getOtSel(range));//  getCursorPosition() getSelectionRange()
            });
          });
          cli.sendOperation = function (revision, operation) {
            var range = editor.getSelection().getRange();
            s.emit('operation', revision, operation, getOtSel(range)) //  getCursorPosition() getSelectionRange()
          }
          s.on('enter', function () {
            var audio = new Audio('to-the-point.mp3');
            audio.play();
          });
          s.on('ack', function () {
            s.emit('ack');
            cli.serverAck();
          });
          s.on('set_name', function (clientId, name) {
            editor.session.remoteNames[clientId] = name;
          });
          s.on('selection', function (clientId, selection) {
            var range= {start: selection.ranges[0].anchor, end: selection.ranges[0].head};
            setCarret(clientId, range);
          });
  function setCarret(origin, range) {
        if (editor.session.remoteCarets[origin]){
            // #A update the existing cursor
            var marker = editor.session.remoteCarets[origin];
            marker.cursors = [range]; // save the cursors as indexes
            editor.getSession()._signal('changeFrontMarker');
            marker.name = editor.session.remoteNames[origin];
            marker.refresh();
        }else{
            // #B create a new cursor
            var marker = new Marker(editor.session, origin, range);
            editor.session.addDynamicMarker(marker, true);
            editor.session.remoteCarets[origin] = marker;
            marker.name = editor.session.remoteNames[origin];
            marker.refresh();
            // call marker.session.removeMarker(marker.id) to remove it
            // call marker.redraw after changing one of cursors
        }
    }
          s.on('operation', function (clientId, operation, selection) {
            console.log(arguments);
scan(); //apply undebounced

            var operation = ot.TextOperation.fromJSON(operation);
            cli.applyServer(operation);
            var range= {start: selection.ranges[0].anchor, end: selection.ranges[0].head};
            setCarret(clientId, range);
          });
          cli.applyOperation = function(operation) {
              var index = 0;
//		  self.editor.removeListener('change', self.onChange);
              operation.ops.map(function(op) {
                if (ot.TextOperation.isRetain(op)) {
                  index += op;
                } else if (ot.TextOperation.isInsert(op)) {

                  var pos = ss[0].session.doc.indexToPosition(index);
//                  skipChange = true;
                  ss[0].session.doc.insert(pos, op)
                  //remoteCaretsUpdate(index,1);

                  index += op.length;
                } else if (ot.TextOperation.isDelete(op)) {
                  var from = ss[0].session.doc.indexToPosition(index);
                  var to = ss[0].session.doc.indexToPosition(index - op);
//                  skipChange = true;
                  ss[0].session.doc.remove(new Range(from.row, from.column, to.row, to.column))
                }
              });
        ss[0].session.otDoc = ss[0].session.getValue();
//        self.editor.on('change', self.onChange);
          }



        })
    function remoteCaretsUpdate(index, length){
        var change = false, document = editor.session.getDocument();
        for (origin in editor.session.remoteCarets){
            var remoteCaret = editor.session.remoteCarets[origin];
            for (var i=0; i<remoteCaret.cursors.length; ++i){
                var cursor = remoteCaret.cursors[i];
                if (cursor.start >= index){
                    cursor.start += length;
                    change = true;
                }
                if (cursor.end >= index){
                    cursor.end += length;
                    change = true;
                }
            }
        }
        if (change){
            editor.session._signal('changeFrontMarker');
        }
    };
        this.init = function (dir) {
          socket.emit('ns', dir);
          var session = this.editor.getSession();
            session.remoteCarets = {};
            session.remoteNames = {};
          session.otDoc = session.getValue();
        }
        this.shut = function (dir) {
          var ss = ses.filter(function(i) { return i.path == dir; });
          ss[0].socket.close();
        }
        editor.on('change', this.onChange);
/*
        editor.session.on('changeAnnotation', this.onChangeAnnotation) //Overwrite worker
        editor.session.diffEv = 1;
        editor.on("changeSession", function(obj) {
          if(!obj.session.diffEv)
            obj.session.on('changeAnnotation', self.onChangeAnnotation)
          obj.session.diffEv = 1;
        })
*/
		this.destroy = function() {
		  this.editor.removeListener('change', this.onChange);
//		  this.editor.session.removeListener('changeAnnotation', this.onChangeAnnotation);
		}
		this.setText = function(val) {
          var session = this.editor.getSession();
          session.diffDoc = val;
          this.scan();
		}
        function getBaseString(diffs, pos) {
          var list = ['<b>', diffs[pos][1], '</b>'];
          function quote(what, mode) {
            return mode == -1 ? '<b style="color:red">' + what + '</b>' : what;
          }
          function seek(dir) {
            var i = pos + dir, found, list = [];
            while (diffs[i] && !found) {
              if (diffs[i][0] != 1) {
                found = diffs[i][1].split(/\r\n?|\n/)
                var item  = dir > 0 ? found[0] : found[found.length - 1];
                list.push(quote(item, diffs[i][0]))
                found = found.length > 1;
              }
              i += dir;
            }
            dir < 0 && list.reverse();
            return list;
          }
          return seek(-1).concat(quote(diffs[pos][1], diffs[pos][0]), seek(1));
        }
        this.scan = scan;
        function scan() {
          var session = self.editor.getSession();
          //session.diffAnnotations = [];
          var markers = session.getMarkers();
//          var gutters = session.$decorations;
//          Object.keys(markers).map(function(i) { if (markers[i].diff) delete markers[i]; });
/*
          Object.keys(gutters).map(function(i) {
                gutters[i] = gutters[i]
                  .split(' ')
                  .filter(function(i) { return i && ['added-gutter', 'changed-gutter'].indexOf(i) < 0;})
                  .join(' ')
          });
*/
          if (session.otDoc && self.editor.getValue()) {
          var d = dmp.diff_main(session.otDoc, self.editor.getValue());
          //dmp.diff_cleanupSemantic(d); //semantic //TODO: add mode
          dmp.diff_cleanupEfficiency(d); //efficiency
if (d.length == 1) return;
          
          function createMarker(cls, pos0, pos1) {
            var id = session.$markerId++;
            var marker = {
              diff: !0,
              range: new Range(pos0.row, pos0.column, pos1.row, pos1.column),
              type: 'text',
              renderer: null,
              clazz: cls || 'added-text',
              inFront: false,
              id: id,
            };
            return markers[id] = marker;
          }
    var docEndLength = self.editor.getValue().length;
    var operation    = new ot.TextOperation().retain(docEndLength);
    var inverse      = new ot.TextOperation().retain(docEndLength);
    var op  = new ot.TextOperation();
    var inv = new ot.TextOperation();
          var p = 0;
          d.filter(function(i) { return i[1].length; })
          .map(function(i, n, o) {
            if (!i[0]) {
              op = op.retain(i[1].length)
              inv = inv.retain(i[1].length)
            }else
            if (i[0] == -1) {
              op = op.delete(i[1].length)
              inv = inv.insert(i[1])
            }else
            if (i[0] == 1) {
              op = op.insert(i[1])
              inv = inv.delete(i[1].length)
            }
          }); //d
          var ss = ses.filter(function(i) { return i.session.id == session.id; });
          ss[0].ot.applyClient(op);
          session.otDoc = self.editor.getValue();
        }
//          this.updateAnnotations(session);
//          session._signal("changeBreakpoint", {}); //gutters
//          session._signal("changeBackMarker", {}); //markers
      }
    }
    return OT
//      var Editor = require("ace/editor").Editor;
/*
      require("ace/config").defineOptions(Editor.prototype, "editor", {
	    setBaseText: {
	    	set: function(val) {
				if (val) {
					if (!this.dmp)
						this.dmp = new DMP(this);
					this.dmp.setText(val);
				}else {
					this.dmp && this.dmp.destroy();
                    this.dmp = undefined;
				}
	    	},
	    },
	    hasDiff: {
	    	get: function(val) {
					return this.dmp && self.hasDiff(self.editor);
			},
		},
      });
*/
});

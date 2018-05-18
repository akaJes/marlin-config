ace.define("diff", function(require, exports, module) {
"use strict";
    var Range = ace.require("ace/range").Range
    if (typeof diff_match_patch != 'function') {
      var error = "preload https://github.com/google/diff-match-patch";
      console.error(error);
      throw new Error(error);
    }
    var dmp = new diff_match_patch();
    dmp.Diff_Timeout = .1;
    dmp.Diff_EditCost = 10;
    var dmpMode = 0; //TODO

    function DMP(editor) {
        this.editor = editor;
		var self = this;
        var dc = debounce(scan, 500, self)
		this.onChange = function(obj, editor) {
			dc(); //self.scan();
		}
		this.updateAnnotations = function(session) {
		  self.editor.renderer.setAnnotations((session.$annotations || []).concat(session.diffAnnotations || []))
        }
		this.onChangeAnnotation = function(obj, session) {
          self.updateAnnotations(session)
		}
		this.nextDiff = {
	    name: "nextDiff",
	    exec: function(editor) {
					self.moveTo(editor, true);
	    },
	    bindKey: {win: "Ctrl-Alt-n", mac: "Command-Alt-n"}
		};
		this.prevDiff = {
	    name: "prevDiff",
	    exec: function(editor) {
				self.moveTo(editor, false);
	    },
	    bindKey: {win: "Ctrl-Alt-p", mac: "Command-Alt-p"}
		};
		this.hasDiff = function(editor) {
			var c = editor.getCursorPosition();
			var m = editor.getSession().getMarkers();
			var p = Object.keys(m)
			.filter(function(i) { return m[i].diff;})
			.map(function(i) { return m[i].range.start;})
				.sort(function(a, b) { return a.row > b.row ? 1 : -1;})
			var f = p.filter(function(i) { return i.row > c.row;})
			var b = p.filter(function(i) { return i.row < c.row;}).reverse();
			return {forward: f[0], backward: b[0]}
		};
		this.moveTo = function(editor, mode) {
			var d = this.hasDiff(editor);
			var p = mode ? d.forward : d.backward;
			p && editor.gotoLine(p.row + 1, p.column);
		}
		editor.on('change', this.onChange);
        editor.session.on('changeAnnotation', this.onChangeAnnotation) //Overwrite worker
        editor.session.diffEv = 1;
	    editor.commands.addCommand(this.nextDiff);
	    editor.commands.addCommand(this.prevDiff);
        editor.on("changeSession", function(obj) {
          if(!obj.session.diffEv)
		    obj.session.on('changeAnnotation', self.onChangeAnnotation)
          obj.session.diffEv = 1;
        })

		this.destroy = function() {
		  this.editor.removeListener('change', this.onChange);
		  this.editor.session.removeListener('changeAnnotation', this.onChangeAnnotation);
	      this.editor.commands.removeCommand(this.nextDiff);
	      this.editor.commands.removeCommand(this.prevDiff);
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
          var session = this.editor.getSession();
          session.diffAnnotations = [];
          var markers = session.getMarkers();
          var gutters = session.$decorations;
          Object.keys(markers).map(function(i) { if (markers[i].diff) delete markers[i]; });
          Object.keys(gutters).map(function(i) {
                gutters[i] = gutters[i]
                  .split(' ')
                  .filter(function(i) { return i && ['added-gutter', 'changed-gutter'].indexOf(i) < 0;})
                  .join(' ')
          });
          if (session.diffDoc && this.editor.getValue()) {
          var d = dmp.diff_main(session.diffDoc, this.editor.getValue());
          //dmp.diff_cleanupSemantic(d); //semantic //TODO: add mode
          dmp.diff_cleanupEfficiency(d); //efficiency
          var p = 0;
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
          d.filter(function(i) { return i[1].length; })
          .map(function(i, n, o) {
            var pos0 = session.doc.indexToPosition(p);
            if (i[0] != -1)
              p += i[1].length;
            if (i[0]) {
              var pos1 = session.doc.indexToPosition(p);
              var gutter = 'added-gutter'
              if (i[0] == 1) { //added
                var marker = createMarker(0, pos0, pos1);
                var prev = o[n - 1];
                if (prev && prev[0] == -1) { //and being removed
                  marker.replace = prev[1];
                  marker.clazz='changed-text';
                  gutter = 'changed-gutter';
                }
              } else
              if (i[0] == -1) { //removed
                createMarker('removed-text', pos0, pos1);
                gutter = 'changed-gutter';
                session.diffAnnotations.push({
                  row: pos0.row,
                  column: pos0.column,
                  html: getBaseString(o, n).join(''),
                  type: "info" // error, warning and info
                })
              }
              for (var i = pos0.row; i <= pos1.row; i++)
              gutters[i] = (gutters[i] || '')
                .split(' ')
                .concat(gutter)
                .filter(function(i, n, o) { return i && o.indexOf(i) == n; })
                .join(' ');
            }
          }); //d
          }
//          session.setAnnotations(session.diffAnnotations);
  //        session._signal("changeAnnotation", {});
          this.updateAnnotations(session);
          session._signal("changeBreakpoint", {}); //gutters
          session._signal("changeBackMarker", {}); //markers
        }
      }
      var Editor = require("ace/editor").Editor;
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
});

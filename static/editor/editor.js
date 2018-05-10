      function createFileUploader(element, tree, editor){
        var input,path;
        $(element).append(input=$('<input>').attr({type:'file',multiple:false,name:'data'}));
        input.on('change',function(e){
          if(this.files.length === 0) return;
          var filename = this.files[0].name;
          var ext = /(?:\.([^.]+))?$/.exec(filename)[1];
          var name = /(.*)\.[^.]+$/.exec(filename)[1];
          if(typeof name !== undefined){
            if(name.length > 8) name = name.substring(0, 8);
            filename = name;
          }
          if(typeof ext !== undefined){
            if(ext === "html") ext = "htm";
            else if(ext === "jpeg") ext = "jpg";
            filename = filename + "." + ext;
          }
          if(path.val() === "/" || path.val().lastIndexOf("/") === 0){
            path.val("/"+filename);
          } else {
            path.val(path.val().substring(0, path.val().lastIndexOf("/")+1)+filename);
          }
        });
        $(element).append(path=$('<input>').attr({id:'upload-path',type:'text',name:'path'}).val('/'));
        function addButton(name,fn){
          $(element).append($('<button>').text(name).on('click',fn));
        }
        addButton('Upload',function(){
          if(input.get(0).files.length === 0) return;
          var formData = new FormData();
          formData.append("data", input.get(0).files[0], path.val());
          uploadHandler('POST',formData);
        });
        addButton('MkDir',function(){
          if(path.val().length < 2) return;
          var dir = path.val();
          if(dir.indexOf(".") !== -1){
            if(dir.lastIndexOf("/") === 0) return;
            dir = dir.substring(0, dir.lastIndexOf("/"));
          }
          createPath(dir);
        });
        addButton('MkFile',function(){
          if(path.val().indexOf(".") === -1) return;
          createPath(path.val());
          editor.loadUrl(path.val());
        });
        addButton('Save',function(e){ editor.saveUrl(); });
        addButton('diff Next',function(e){ editor.execCommand("nextDiff") });
        addButton('diff Prev',function(e){ editor.execCommand("prevDiff") });
        addButton('Beautify selected', function(e) {
          if (!editor.getSelectedText()) return;
          var beautify = ace.require("ace/ext/beautify"); // get reference to extension
          var session = ace.createEditSession('demo', editor.session.getOption('mode'));
//          var sel = editor.session.getSelection();
          var range = editor.selection.getRange();
          range.start.column = 0;
          range.end.column = undefined;
          var val = editor.session.doc.getTextRange(range);
          session.setValue(val);
          beautify.beautify(session);
          var b = session.getValue();
          editor.session.doc.replace(range, b);
          editor._signal("change", {});
        });
        function uploadHandler(type,form){
          $.ajax({url:'/edit',type: type, data:form, contentType: false, processData: false})
          .then(function(data){
            tree.refreshPath(path.val());
            $('.tree').jstree('refresh');
          },function(data){
            alert("ERROR["+data.status+"]: "+data.responseText);
          });
        }
        function createPath(p){
          var formData = new FormData();
          formData.append("path", p);
          uploadHandler('PUT',formData);
        }
      }

      function createTree(element, editor) {
        fsbrowser($('.tree'), loadEditor)
return;
        $('.tree').jstree({
            'core' : {
              check_callback : true, //allow delete_node
                "multiple" : false,
		        'data' : {
		          'url' : '/s/editor/tree',
		          'data' : function (node) {
		              return { 'dir' : (node.id=='#'?'/':node.id) };
		          }
		        }
          },
          "plugins":["contextmenu"],
          "contextmenu":{
            "items": function(node) {
              var items={};
              var api=$('.tree');
              var opened=node.state.opened;
              var path=node.id;
              var isfile=/file/.test(node.original.icon||'');
              if (isfile){
                if(isTextFile(path)){
                  items["Edit"]={label:"Edit",action:function(e){
                      loadEditor(path);
                    }
                  };
                }else{
                  items["Preview"]={label:"Preview",action:function(e){
                      loadPreview(path);
                    }
                  };
                }
                items["Download"]={label:"Download",action:function(e){
                    loadDownload(path);
                  }
                };
              }else{
                if(opened){
                  items["Collapse"]={label:"Collapse",action:function(e){
                      api.jstree('close_node',node.id);
                    }
                  };
                  items["Refresh"]={label:"Refresh",action:function(e){
                      api.jstree('refresh_node',node.id);
                    }
                  };
                }else{
                  items["Expand"]={label:"Expand",action:function(e){
                      api.jstree('open_node',node.id);
                    }
                  };
                }
                items["Upload"]={label:"Upload",action:function(e){
                    var pathEl=$("#upload-path"),subPath=pathEl.val();
                    if(subPath.lastIndexOf("/") < 1) pathEl.val(path+subPath);
                      else pathEl.val(path.substring(subPath.lastIndexOf("/"))+subPath);
                  }
                };
              }
              items["Delete"]={label:"Delete",action:function(e){
                  if (confirm('Are You shure?'))
                    httpDelete(path);
                }
              };
            return items;
            }
          }
        })
        .on("dblclick.jstree", function (event) {
          var node = $(event.target).closest("li");
          var path = node.attr('id');
          if(isTextFile(path))
            loadEditor(path);
          else
          if(isImageFile(path))
            loadPreview(path);
        });
        function loadEditor(path){
          $('#editor').show();
          $('#preview').hide();
          editor.loadUrl(path);
        }
        function loadDownload(path){
          $('#download-frame').attr('src',path+"?download=true");
        }
        function loadPreview(path){
          $('#editor').hide();
          $('#preview').show().html('<img src="'+path+'" style="max-width:100%; max-height:100%; margin:auto; display:block;" />');
        }
        function isTextFile(path){
          var ext = (/(?:\.([^.]+))?$/.exec(path)[1]||'').toLowerCase();
          return 'cpp,c,h,hpp,ino,ini,md,txt,htm,js,c,spp,css,xml'.split(',').indexOf(ext)>=0;
        }
        function isImageFile(path){
          var ext = (/(?:\.([^.]+))?$/.exec(path)[1]||'').toLowerCase();
          return 'png,jpg,gif'.split(',').indexOf(ext)>=0;
        }
        this.refreshPath = function(path){
          if(path.lastIndexOf('/') < 1)
            path = '/';
          else
            path = path.substring(0, path.lastIndexOf('/'));
        };
        var self=this;
        function httpDelete(path){
          var formData = new FormData();
          formData.append("path", path);
          $.ajax({url:'/edit',type:'DELETE',data:formData,contentType: false, processData: false})
          .then(function(data){
            $('.tree').jstree('delete_node',path);
            self.refreshPath(path);
          },function(data){
            alert("ERROR["+data.status+"]: "+data.responseText);
          });
        }
        return this;
      }

      function createEditor(element, file, lang, theme, type){
        var editor = ace.edit(element);
new (require("marker_tooltip").MarkerTooltip)(editor); // show previous text over highlighted
        function getLangFromFilename(filename){
          var lang = "plain";
          var ext = (/(?:\.([^.]+))?$/.exec(filename)[1]||'').toLowerCase();;
          if(typeof ext !== undefined){
            switch(ext){
              case "txt": lang = "plain"; break;
              case "htm": lang = "html"; break;
              case "md": lang = "markdown"; break;
              case "js": lang = "javascript"; break;
              case "c":case "h": lang = "c_cpp"; break;
              case "cpp":case "hpp": lang = "c_cpp"; break;
              case "css":
              case "scss":
              case "php":
              case "html":
              case "json":
              case "xml":
                lang = ext;
            }
          }
          return lang;
        }
        function httpPost(filename, data, type){
          var formData = new FormData();
          formData.append("data", new Blob([data], { type: type }), filename);
          $.post({url:'/edit',data:formData,contentType: false, processData: false})
          .then(function(data){
            alert('saved!');
          },function(data){
            alert("ERROR["+data.status+"]: "+data.responseText);
          });
        }
        function httpGet(theUrl) {
          $.when($.get('/s/editor/files' + theUrl), $.get('/s/editor/git' + theUrl))
          .then(function(data, dataGit){
            editor.setOptions({setBaseText: dataGit[0] })
            editor.setValue(data[0]);
//            editor.clearSelection();
            editor.gotoLine(0);
            editor.getSession()._signal("changeAnnotation", {}); //TODO: bug update
          },function(data){
            editor.setValue("");
            alert("ERROR["+data.status+"]: "+data.responseText);
          });
        }
        function httpGet0(theUrl) {
          $.get(theUrl).then(function(data){
            editor.setValue(data);
            editor.clearSelection();
          },function(data){
            editor.setValue("");
            alert("ERROR["+data.status+"]: "+data.responseText);
          });
        }
        if(typeof theme === "undefined") theme = "textmate";

//        ace.config.loadModule('/libs/diff-match-patch/index', function() {
          ace.config.loadModule('diff', function(diff) {
            console.log('diff loaded')
          });
//        });
        ace.config.loadModule('ace/ext/beautify', function(diff) {
          console.log('ace/ext/beautify loaded')
        });
        editor.setTheme("ace/theme/"+theme);
        editor.$blockScrolling = Infinity;
        editor.getSession().setUseSoftTabs(true);
        editor.getSession().setTabSize(2);
        editor.setHighlightActiveLine(true);
        editor.setShowPrintMargin(false);
        editor.commands.addCommand({
            name: 'saveCommand',
            bindKey: {win: 'Ctrl-S',  mac: 'Command-S'},
            exec: function(editor) {
              httpPost(file, editor.getValue()+"", type);
            },
            readOnly: false
        });
        editor.commands.addCommand({
            name: 'undoCommand',
            bindKey: {win: 'Ctrl-Z',  mac: 'Command-Z'},
            exec: function(editor) {
              editor.getSession().getUndoManager().undo(false);
            },
            readOnly: false
        });
        editor.commands.addCommand({
            name: 'redoCommand',
            bindKey: {win: 'Ctrl-Shift-Z',  mac: 'Command-Shift-Z'},
            exec: function(editor) {
              editor.getSession().getUndoManager().redo(false);
            },
            readOnly: false
        });
	      editor.saveUrl = function(){
	        httpPost(file, editor.getValue()+"", type);
	      }
        editor.loadUrl = function(filename, lang, type){
          file=filename;
          if(typeof file === "undefined") return file = "/index.htm";
          if(typeof lang === "undefined")
            lang = getLangFromFilename(file);
          if(typeof type === "undefined"){
            type = "text/"+lang;
            if(lang === "c_cpp") type = "text/plain";
          }
          if(lang !== "plain") editor.getSession().setMode("ace/mode/"+lang);
          httpGet(file);
        }
        editor.loadUrl(file,lang,type);
        return editor;
      }
      $(function(){
        $(window).on('beforeunload',function() { return "Realy?"; });
        var vars = {};
        var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) { vars[key] = value; });
        var editor = createEditor("editor", vars.file, vars.lang, vars.theme);
        var tree = createTree("tree", editor);
        createFileUploader(".uploader", tree, editor);
      });

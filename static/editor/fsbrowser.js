function fsbrowser(ui, cb) {
	ui.jstree({
		'core' : {
			'data' : {
			    'url' : '/s/editor/tree',
			    'data' : function (node) {
				return { 'id' : node.id };
			    }
			},
			'check_callback' : function(o, n, p, i, m) {
			    if(m && m.dnd && m.pos !== 'i') { return false; }
			    if(o === "move_node" || o === "copy_node") {
				if(this.get_node(n).parent === this.get_node(p).id) { return false; }
			    }
			    return true;
			},
			'force_text' : true,
			'themes' : {
			    'responsive' : false,
			    'variant' : 'small',
			    'stripes' : true
			}
		},
		'sort' : function(a, b) {
			return this.get_type(a) === this.get_type(b) ? (this.get_text(a) > this.get_text(b) ? 1 : -1) : (this.get_type(a) >= this.get_type(b) ? 1 : -1);
		},
		'contextmenu' : {
			'items' : function(node) {
			    var tmp = $.jstree.defaults.contextmenu.items();
			    delete tmp.create.action;
                function action(params) {
                  return function (data) {
					var inst = $.jstree.reference(data.reference);
					var obj = inst.get_node(data.reference);
					inst.create_node(obj, params, "last", function (new_node) {
					    setTimeout(function () { inst.edit(new_node); },0);
					});
				  }
                }
			    tmp.create.label = "New";
			    tmp.create.submenu = {
				  "create_folder" : {
				    "separator_after"	: true,
				    "label"				: "Folder",
				    "action"			: action({type : "default", icon: 'jstree-folder'}),
				  },
				  "create_file" : {
				    "label"				: "File",
				    "action"			: action({type : "file", icon: 'jstree-file' }),
				  }
			    };
			    if(this.get_type(node) === "file") {
				delete tmp.create;
			    }
			    return tmp;
			}
		},
		'types' : {
			'default' : { 'icon' : 'jstree-folder' },
			'file' : { 'valid_children' : [], 'icon' : 'jstree-file' }
		},
		'unique' : {
			'duplicate' : function (name, counter) {
			    return name + ' ' + counter;
			}
		},
		'plugins' : ['state','dnd','sort','types','contextmenu','unique']
	})
	.on('delete_node.jstree', function (e, data) {
		    $.ajax({url: '/s/editor/file' + data.node.id, method: 'delete'})
			.fail(function () {
			    data.instance.refresh();
			});
	})
	.on('rename_node.jstree', function (e, data) {
            (/\//.test(data.node.id)
            && $.ajax({method: 'put', url: '/s/editor/file' + data.node.id, data: {to: data.node.parent + '/' + data.text}})
            || $.post('/s/editor/file' + data.node.parent + '/' + data.node.text, {type: data.node.type})
            )
			.done(function (d) {
			    data.instance.set_id(data.node, d.id);
			})
			.fail(function () {
			    data.instance.refresh();
			});
	})
	.on('move_node.jstree', function (e, data) {
            $.ajax({method: 'put', url: '/s/editor/file' + data.node.id, data: {to: data.parent + '/' + data.node.text}})
			.done(function (d) {
			    //data.instance.load_node(data.parent);
			    data.instance.refresh();
			})
			.fail(function () {
			    data.instance.refresh();
			});
	})
		.on('copy_node.jstree', function (e, data) { //TODO
		    $.get('?operation=copy_node', { 'id' : data.original.id, 'parent' : data.parent })
			.done(function (d) {
			    //data.instance.load_node(data.parent);
			    data.instance.refresh();
			})
			.fail(function () {
			    data.instance.refresh();
			});
		})
		.on('changed.jstree', function (e, data) {
		    if(data && data.selected && data.selected.length) {
            var name = data.selected.join(':');
            return cb(name)
//            var type = getType(name);
			$.get('/s/editor/files' + name, function (d) {
			    if(d && typeof d.type !== 'undefined') {
				$('#data .content').hide();
				switch(d.type) {
				    case 'text':
				    case 'txt':
				    case 'md':
				    case 'htaccess':
				    case 'log':
				    case 'sql':
				    case 'php':
				    case 'js':
				    case 'json':
				    case 'css':
				    case 'html':
					$('#data .code').show();
					$('#code').val(d.content);
					break;
				    case 'png':
				    case 'jpg':
				    case 'jpeg':
				    case 'bmp':
				    case 'gif':
					$('#data .image img').one('load', function () { $(this).css({'marginTop':'-' + $(this).height()/2 + 'px','marginLeft':'-' + $(this).width()/2 + 'px'}); }).attr('src',d.content);
					$('#data .image').show();
					break;
				    default:
					$('#data .default').html(d.content).show();
					break;
				}
			    }
			});
		    }
		    else {
			$('#data .content').hide();
			$('#data .default').html('Select a file from the tree.').show();
		    }
		});
	}
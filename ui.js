/*
 * ui.js
 */

const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GtkSource = imports.gi.GtkSource;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const Signals = imports.signals;
const System = imports.system;
const Format = imports.format;
String.prototype.format = Format.format;
imports.searchPath.unshift(GLib.path_get_dirname(System.programInvocationName));

var Ui = new Lang.Class({
    Name: "Ui",
    Extends: Gtk.Application,
    _init: function(props) {
	props = props || {};
	this.name = props.name || GLib.path_get_basename(System.programInvocationName);
	this.path = props.path || GLib.path_get_dirname(System.programInvocationName);
	GLib.set_prgname(this.name);
	this.parent({application_id: props.application_id ||
		     'org.gnome.extension.' + this.name});
	this.set_resource_base_path(this.path);
    },
    vfunc_activate: function() {
	if(!this.window) {
	    this.window = Gtk.ApplicationWindow.new(this);
	    this.window.set_default_size(960, 540);
	    this.window.set_position(Gtk.WindowPosition.CENTER);
	    this.window.set_title(this.name.split('.')[0]);
	    (new GtkSource.View()).destroy(); //registering GtkSourceView gtype for glade parsing
	    this.main = Gtk.Builder.new_from_file(this.path + '/glade/main.glade');
	    this.window.add(this.main.get_object('box1'));
	    this._lang_manager_init();
	}
	this.window.show_all();
	this._add_details_handler();
	this._add_show_message_button_handler();
	this._clear();
    },
    _lang_manager_init: function() {
	this.langmanager = GtkSource.LanguageManager.get_default();
	this.langmanager.langmap = {};
	this.langmanager.get_language_ids().forEach(Lang.bind(this, function(id) {
	    let lang = this.langmanager.get_language(id);
	    this.langmanager.langmap[lang.name.toLowerCase()] = lang;
	}));
    },
    _add_details_handler: function() {
	this.main.get_object('grid1').hide();
	this.main.get_object('togglebutton1').connect('toggled', Lang.bind(this, function(togglebutton1) {
	    let grid1 = this.main.get_object('grid1');
	    
	    if(togglebutton1.get_active()) {
		grid1.show();
	    }
	    else {
		grid1.hide();
	    }
	}));
    },
    _clear: function() {
	this.main.get_object('grid2').hide();
	this.main.get_object('box4').hide();
	this.main.get_object('progressbar1').hide();
	this.main.get_object('togglebutton1').set_active(false);
	this.main.get_object('entry1').set_text('');
	this.main.get_object('entry2').set_text('');
	this.main.get_object('checkbutton1').set_active(false);
	this.main.get_object('label5').set_text('');
	this.main.get_object('label6').set_text('');
	this.main.get_object('label9').set_text('');
	this.main.get_object('label10').set_text('');
	this.main.get_object('label11').set_text('');
	this.main.get_object('label12').set_text('');
	delete this.main.get_object('button2').file;
	delete this.main.get_object('button3').file;
	this.main.get_object('gtksourceview1').get_buffer().set_language(null);
	this.main.get_object('gtksourceview1').get_buffer().set_text('', 0);
	this.main.get_object('gtksourceview1').grab_focus();
    },
    add_file: function(file, content) {
	let button = new Gtk.Button({label: file.filename});
	let listbox1 = this.main.get_object('listbox1');
	
	if(!listbox1.buttons) listbox1.buttons = [];
	listbox1.buttons.unshift(button);
	this._clear();
	
	button.get_child().set_halign(Gtk.Align.START);
	button.connect('clicked', Lang.bind(this, function(button, file) {
	    let label5 = this.main.get_object('label5');
	    let label6 = this.main.get_object('label6');
	    let label9 = this.main.get_object('label9');
	    let label10 = this.main.get_object('label10');
	    let label11 = this.main.get_object('label11');
	    let label12 = this.main.get_object('label12');
	    let button2 = this.main.get_object('button2');
	    let button3 = this.main.get_object('button3');
	    let gtksourceview1 = this.main.get_object('gtksourceview1');
	    let buffer = gtksourceview1.get_buffer();
	    let language = null;

	    file.button = button;
	    button2.file = file;
	    button3.file = file;
	    
	    if(file.content instanceof Function) {
		buffer.set_text('', 0);
		file.content(file.raw_url, Lang.bind(file, function(content, buffer) {
		    this.content = content;
		    buffer.set_text(content, content.length);
		}, buffer));
	    }
	    else {
		buffer.set_text(file.content, file.content.length);
	    }
	    
	    if(file.language) {
		language = this.langmanager.langmap[file.language.toLowerCase()];
		if(language) buffer.set_language(language);
	    }

	    label5.set_text(file.filename);
	    if(file.gist.description) {
		label6.set_text(file.gist.description);
		label6.set_line_wrap(true);
	    }
	    else {
		label6.set_text('');
	    }
	    label9.set_text(file.gist.public.toString());
	    let updated_at = GLib.DateTime.new_from_timeval_utc(GLib.TimeVal.from_iso8601(file.gist.updated_at)[1]);
	    label10.set_text(updated_at.to_local().format("%a, %d %b %Y %T %z")); //rfc-8322
	    label11.set_markup('<a href="' + file.gist.html_url + '">' + file.gist.html_url + '</a>');
	    if(file.gist.owner) {
		label12.set_markup('<a href="' + file.gist.owner.html_url + '">' + file.gist.owner.login + '</a>');
	    }
	    else {
		label12.set_text('');
	    }
	}, file));
	listbox1.prepend(button);
	button.show();
    },
    remove_file: function(file) {
	let listbox1 = this.main.get_object('listbox1');
	
	this._clear();
	listbox1.buttons = listbox1.buttons.filter(Lang.bind(file, function(button) {
	    return this.button != button;
	}));
	file.button.get_parent().destroy();
    },
    enable_more: function(callback) {
	let button1 = this.main.get_object('button1');
	if(!button1.sensitive) button1.sensitive = true;
	if(button1.callback_id) GObject.signal_handler_disconnect(button1, button1.callback_id);
	button1.callback_id = button1.connect('clicked', Lang.bind(this, function(button1, callback) {
	    button1.sensitive = false;
	    callback();
	}, callback));
    },
    add_delete_handler: function(callback) {
	let button3 = this.main.get_object('button3');
	button3.connect('clicked', Lang.bind(this, function(button3, callback) {
	    callback(button3.file);
	}, callback));
    },
    add_save_handler: function(callback) {
	let button2 = this.main.get_object('button2');
	let button4 = this.main.get_object('button4');
	let button5 = this.main.get_object('button5');
	
	button2.connect('clicked', Lang.bind(this, function(button2) {
	    let entry1 = this.main.get_object('entry1');
	    let entry2 = this.main.get_object('entry2');
	    let checkbutton1 = this.main.get_object('checkbutton1');
	    
	    if(!entry1.is_visible()) {
		this.main.get_object('grid2').show();
		if(button2.file) {
		    entry1.set_text(button2.file.filename);
		    entry2.set_text(button2.file.gist.description);
		    checkbutton1.set_active(button2.file.gist.public);
		}
	    }
	}));
	button4.connect('clicked', Lang.bind(this, function(button4, callback) {
	    let entry1 = this.main.get_object('entry1');
	    let entry2 = this.main.get_object('entry2');
	    let checkbutton1 = this.main.get_object('checkbutton1');
	    let gtksourceview1 = this.main.get_object('gtksourceview1');
	    let buffer = gtksourceview1.get_buffer();
	    let start = null;
	    let end = null;
	    this.main.get_object('grid2').hide();
	    [start, end] = buffer.get_bounds();
	    callback(entry1.get_text(),
		     buffer.get_text(start, end, true),
		     entry2.get_text(),
		     checkbutton1.get_active(),
		     button2.file);
	}, callback));
	button5.connect('clicked', Lang.bind(this, function(button5) {
	    this.main.get_object('grid2').hide();
	}));
    },
    add_list_handlers: function(callbacks) {
	let comboboxtext1 = this.main.get_object('comboboxtext1');
	comboboxtext1.connect('changed', Lang.bind(this, function(comboboxtext1, callbacks) {
	    let text = comboboxtext1.get_active_text();
	    let listbox1 = this.main.get_object('listbox1');
	    
	    while(listbox1.buttons && listbox1.buttons.length > 0) {
		listbox1.buttons.shift().get_parent().destroy();
	    }
	    this.main.get_object('button1').sensitive = false;
	    this._clear();
	    
	    if(text != 'compose') {
		callbacks[text]();
	    }
	}, callbacks));
    },
    progress_handler: function(fraction) {
	let progressbar1 = this.main.get_object('progressbar1');
	progressbar1.show();
	progressbar1.set_fraction(fraction);
	if(fraction >= 1) progressbar1.hide();
    },
    _add_show_message_button_handler: function() {
	let box4 = this.main.get_object('box4');
	box4.hide();
	this.main.get_object('button6').connect('clicked', Lang.bind(box4, function(button) {
	    this.hide();
	}));
    },
    show_message: function(message) {
	let box4 = this.main.get_object('box4');
	let label16 = this.main.get_object('label16');
	box4.show();
	label16.set_text(message);
    }
});

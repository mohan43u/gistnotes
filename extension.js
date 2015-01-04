/*
 * gistnotes extension
 */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
let button = null;
let child = null;

function _button_press_event_cb() {
    if(!child) {
	child = Gio.Subprocess.new([Me.imports.searchPath + '/gistnotes.js'],
				   Gio.SubprocessFlags.INHERIT_FDS);
	child.wait_async(null, function(source, result) {
	    source.wait_finish(result);
	    child = null;
	});
    }
}

function init() {
    button = new St.Bin({style_class: 'panel-button',
			 reactive: true,
			 can_focus: true,
			 x_fill: true,
			 y_fill: true,
			 track_hover: true});
    let gfile = Gio.File.new_for_path(Me.imports.searchPath + '/icons/gistnotes.png');
    let gicon = Gio.FileIcon.new(gfile);
    gicon.load(gfile.query_info("standard::size",
				Gio.FileQueryInfoFlags.NONE,
				null).get_attribute_uint64("standard::size"),
	       null);
    let icon = new St.Icon({gicon: gicon,
			    style_class: 'system-status-icon'});
    button.set_child(icon);
    button.connect('button-press-event', _button_press_event_cb);
}

function enable() {
    Main.panel._rightBox.insert_child_at_index(this.button, 0);
}

function disable() {
    if(child) {
	child.force_exit();
    }
    Main.panel._rightBox.remove_child(this.button);
}

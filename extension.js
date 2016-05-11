const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const MessageTray = imports.ui.messageTray;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Soup = imports.gi.Soup;
const ExtensionUtils = imports.misc.extensionUtils;
const Meta = ExtensionUtils.getCurrentExtension();
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const Gst = imports.gi.Gst;

const WHOAMI = 'momcilosystem';
const COMMAND = 'ttv';
//const COMMAND = 'livestreamer';
const SOUND_FILE = 'file:///usr/share/sounds/freedesktop/stereo/complete.oga';
const PLAY_SOUND = true;

let text, button, followedChannels, onlineChannels, oldOnline, refreshTime, mainloopID;

function _logIt(customVar) {
	global.log("Twitch.tv Notifier: customVar:" + customVar);
	global.log("Twitch.tv Notifier: refreshTime:" + refreshTime);
	global.log("Twitch.tv Notifier: Follow JSON:" + followedChannels);
	global.log("Twitch.tv Notifier: Online JSON:" + onlineChannels);
	global.log("Twitch.tv Notifier: oldOnline JSON:" + oldOnline);
}

function _showNotify(text) {
	let source = new MessageTray.SystemNotificationSource();
	Main.messageTray.add(source);
	let notification = new MessageTray.Notification(source, text, null);
	notification.setTransient(true);
	source.notify(notification);
}

function _startStream(streamName) {
//	Uncomment these lines for livestreamer:
//	let streamURL = "www.twitch.tv/"+streamName;
//	imports.misc.util.spawn([COMMAND, streamURL,"best"]);
//
//	Comment out this line for livestreamer:
	imports.misc.util.spawn([COMMAND, streamName]);
}

function _playSound(uri) {
	if ( typeof this.player == 'undefined' ) {
		Gst.init(null, 0);
		this.player = Gst.ElementFactory.make("playbin","player");
		this.playBus = this.player.get_bus();
		this.playBus.add_signal_watch();
		this.playBus.connect("message", Lang.bind(this,
		function(playBus, message) {
			if (message != null) {
				let t = message.type;
				if ( t == Gst.MessageType.EOS || t == Gst.MessageType.ERROR) {
					this.player.set_state(Gst.State.READY);
				}
			}
		}));
	}
	this.player.set_property('uri', uri);
	this.player.set_state(Gst.State.PLAYING);
}

function _readFollows(userName) {
	let session = new Soup.SessionAsync();
	let theUrl = "https://api.twitch.tv/kraken/users/"+userName+"/follows/channels";
	let message = Soup.Message.new('GET', theUrl);
	session.queue_message(message, function(session, message) {
			followedChannels = message.response_body.data;
		});
}

function _readOnline(queryChannels) {
	let session = new Soup.SessionAsync();
//	Example of hard-coding follows (without actually following):
	let theUrl = "https://api.twitch.tv/kraken/streams?channel="+queryChannels+"lirik,debelimoma";
	let message = Soup.Message.new('GET', theUrl);
	session.queue_message(message, function(session, message) {
			onlineChannels = message.response_body.data;
		});
}

function _myButton() {
	this._init();
}

_myButton.prototype = {
	__proto__: PanelMenu.Button.prototype,

	_init: function() {
		PanelMenu.Button.prototype._init.call(this, 0.0);
		this._label = new St.Bin({ style_class: 'panel-button',
						reactive: true,
						can_focus: true,
						x_fill: true,
						y_fill: false,
						track_hover: true });
		let icon = new St.Icon({ icon_name: 'utilities-twitch-symbolic',
						style_class: 'system-status-icon',
					icon_size: 20 });
		this._label.set_child(icon);
		this.actor.add_actor(this._label);

		this._myMenu = new PopupMenu.PopupMenuItem('Initializing...');
		this.menu.addMenuItem(this._myMenu);
		this._myMenu.connect('activate', Lang.bind(this, function() {
						_logIt("Init button");
						}));
		mainloopID = Mainloop.timeout_add_seconds(refreshTime, Lang.bind(this, _checkStreams));

	},

	_onDestroy: function() {
	}
};

function _checkStreams() {

	/*
		TODO:
	-Add support for large amounts of channel (JSON limit)
	-Add settings:
		* username
		* what program to run...
		* ...with what arguments
		* disable notify/sound for certain channels
		* disable notify/sound for all
	-Add additional info from channels in the list
	-Add check interval
	-Add 'Reload follows' button

	Juhaz: "rather than having globals, trying to turn your extension into a class and storing the id in that would probably the "right" way of doing it though it takes some restructuring."

	*/

	global.log("Twitch.tv Notifier: checking streams at interval " + refreshTime);
	// global.log("Twitch.tv Notifier: uniz: followedChannels " + followedChannels);

	let myFollows = "";
	if (followedChannels != "" && followedChannels != null) {
		if (followedChannels.indexOf("502 Bad Gateway") == -1) {
			let tmpFollowed = JSON.parse(followedChannels);
			if (tmpFollowed.follows != null){
				for(let index in tmpFollowed.follows){
					myFollows = myFollows + tmpFollowed.follows[index].channel.name + ",";
				}
			}
		} else {
			global.log("Twitch.tv Notifier: Bad Gateway in followedChannels variable START>>" + followedChannels + "<<END");
			let followedChannels = "";
		}
	}

	// Sometimes Twitch.tv will return JSON with 0 online channels by mistake, we check that here:
	// Also sometimes onlineChannels variable is null in next line... check that
	// TODO: Check what happens when all streams go down?
	if (onlineChannels != "" && JSON.parse(onlineChannels)._total > 0) {
		let tmpOnline = JSON.parse(onlineChannels);
		if (tmpOnline.streams != null){
			// Check if this means that if we have no online channel and one appear - notification will not go off
			if (oldOnline != ""){
				let tmpOnline2 = JSON.parse(oldOnline);
				let newStream = true;
				for (let newCounter in tmpOnline.streams){
					newStream = true;
					for (let oldCounter in tmpOnline2.streams){
						if (tmpOnline.streams[newCounter].channel.name == tmpOnline2.streams[oldCounter].channel.name){
							newStream = false
						}
					}
					if (newStream == true) {
						_playSound(SOUND_FILE);
						if (PLAY_SOUND) {_showNotify(tmpOnline.streams[newCounter].channel.display_name)}
					}
				}
			}
			button.menu.removeAll();

			for (let index in tmpOnline.streams){
				let streamName = tmpOnline.streams[index].channel.name;
				button._myMenu = new PopupMenu.PopupMenuItem(tmpOnline.streams[index].channel.display_name + " [" + tmpOnline.streams[index].viewers + "]");
				button.menu.addMenuItem(this._myMenu);
				this._myMenu.connect('activate', Lang.bind(this, function() {
						_startStream(streamName);
						}));
			}
//
//			This is code for 'Debug' button which outputs variables to log
//
//			button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
//			button._myMenu = new PopupMenu.PopupMenuItem('Debug');
//			button.menu.addMenuItem(this._myMenu);
//			this._myMenu.connect('activate', Lang.bind(this, function() {
//						_logIt("Debug button");
//					}));
//
//
			oldOnline = onlineChannels;
		}
	} else {
		button.menu.removeAll();
		this._myMenu = new PopupMenu.PopupMenuItem('List empty...');
		this.menu.addMenuItem(this._myMenu);
		this._myMenu.connect('activate', Lang.bind(this, function() { _logIt("List empty button"); }));
	}
	_readFollows(WHOAMI);
	if (myFollows != "") {
		// If this is second read, do it in 10 secs. Third and all others are at 5 mins
		if (refreshTime == 10) {
			_readOnline(myFollows);
			mainloopID = Mainloop.timeout_add_seconds(refreshTime, Lang.bind(this, _checkStreams));
			refreshTime = 300;
		} else {
			_readOnline(myFollows);
			mainloopID = Mainloop.timeout_add_seconds(refreshTime, Lang.bind(this, _checkStreams));
		}
	} else {
		// If this is the first read, schedule next in 10 secs
		mainloopID = Mainloop.timeout_add_seconds(refreshTime, Lang.bind(this, _checkStreams));
	}
}

function init() {
	let theme = imports.gi.Gtk.IconTheme.get_default();
	theme.append_search_path(Meta.dir.get_child('icons').get_path());
}

function enable() {
	refreshTime = 10;
	followedChannels = "";
	onlineChannels = "";
	oldOnline = "";
	button = new _myButton();
	Main.panel.addToStatusArea('twitchnotify', button, 2);
}

function disable() {
	Mainloop.source_remove(mainloopID);
	button.destroy();
}

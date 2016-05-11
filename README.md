# TwitchNotify
Shows online channels on streaming service Twitch.tv

By default this extension uses my internal script called 'ttv'.
To change to livestreamer, edit extensions.js and replace ttv wih livestreamer:
 ...
 const COMMAND = 'ttv';
 ...

Also, adjust lines in "_startStream" function:
 ...
 function _startStream(streamName) {
 //      Uncomment these lines for livestreamer:
 //      let streamURL = "www.twitch.tv/"+streamName;
 //      imports.misc.util.spawn([COMMAND, streamURL,"best"]);
 //
 //      Comment out this line for livestreamer:
         imports.misc.util.spawn([COMMAND, streamName]);
 }
 ...

If there is a lot of interest in this extension, I'll make livestreamer the default.

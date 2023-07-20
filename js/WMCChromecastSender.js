'use strict';

const DEMO_MODE = false;
/** @const {string} Media source root URL */
const MEDIA_SOURCE_ROOT = '';
/**
 * Controls if Ads are enabled. Controlled by radio button.
 * @type {boolean}
 */
let ENABLE_ADS = false;
/**
 * Controls if Live stream is played. Controlled by radio button.
 * @type {boolean}
 */
let ENABLE_LIVE = false;
/**
 * Buffer to decide if the live indicator should be displayed to show that
 * playback is at the playback head.
 * @const {number}
 */
const LIVE_INDICATOR_BUFFER = 50;
/**
 * Width of progress bar in pixels.
 * @const {number}
 */
const PROGRESS_BAR_WIDTH = 700;
/**
 * Time in milliseconds for minimal progress update.
 * @const {number}
 */
const TIMER_STEP = 1000;
/**
 * Cast volume upon initial connection.
 * @const {number}
 */
const DEFAULT_VOLUME = 0.5;
/**
 * Height, in pixels, of volume bar.
 * @const {number}
 */
const FULL_VOLUME_HEIGHT = 100;
/** @enum {string} Constants of states for media for both local and remote playback */
const PLAYER_STATE = {
  // No media is loaded into the player. For remote playback, maps to
  // the PlayerState.IDLE state.
  IDLE: 'IDLE',
  // Player is in PLAY mode but not actively playing content. For remote
  // playback, maps to the PlayerState.BUFFERING state.
  BUFFERING: 'BUFFERING',
  // The media is loaded but not playing.
  LOADED: 'LOADED',
  // The media is playing. For remote playback, maps to the PlayerState.PLAYING state.
  PLAYING: 'PLAYING',
  // The media is paused. For remote playback, maps to the PlayerState.PAUSED state.
  PAUSED: 'PAUSED'
};

const WMCChromeCastSenderEvent = {
  /** @member {string} */
  /** This event is triggered when the position of the knob on the video progress bar is changed (due to user input) */
  VideoSliderPositionChange: "onVideoSliderPositionChange",
  /** @member {string} */
  /** This event is triggered on click of the restart button */
  RestartClick: "onRestartButtonClick",
  /** @member {string} */
  /** This event is triggered on click of the resume button */
  ResumeClick: "onResumeButtonClick",
  /** @member {string} */
  /** This event is triggered on click of the play button */
  PlayClick: "onPlayButtonClick",
  /** @member {string} */
  /** This event is triggered on click of the pause button */
  PauseClick: "onPauseButtonClick",
  /** @member {string} */
  /** This event is triggered on click of the stop button */
  StopClick: "onStopButtonClick",
  /** @member {string} */
  /** This event is triggered on click of the seek button */
  SeekClick: "onSeekButtonClick",
  /** @member {string} */
  /** This event is triggered on click of the liveNow button */
  LiveNowClick: "onLiveNowButtonClick",
  /** @member {string} */
  /** This event is triggered on click of the volumeToggle button */
  VolumeToggleClick: "onVolumeToggleButtonClick",
  /** @member {string} */
  /** This event is triggered when the position of the knob on the volume progress bar is changed (due to user input) */
  VolumeSliderPositionChange: "onVolumeSliderPositionChange",
  /** @member {string} */
  /** This event is triggered when the closed captions toggle switch state changes */
  CCToggle: "onCCToggle",
  /** @member {string} */
  /** This event is triggered when the subtitle track is selected */
  SubtitleTrackSelect: "onSubtitleTrackSelect",
  /** @member {string} */
  /** This event is triggered when an audio track is selected */
  AudioTrackSelect: "onAudioTrackSelect",
  /** @member {string} */
  /** This event is triggered when the playback speed is selected */
  PlaybackSpeedSelect: "onPlaybackSpeedSelect",
  /** @member {string} */
  /** This event is triggered when the log level is slected */
  LogLevelSelect: "onLogLevelSelect",
  /** @member {string} */
  /** This event is triggered when a source list item is selected */
  SourceListItemSelected: "onSourceListItemSelect",
  /** @member {string} */
  /** This event is triggered when the Get InHome Status Button in the config form is clicked */
  GetInhomeServerStatusButtonClick: "onGetInhomeServerStatusButtonClick",
  /** @member {string} */
  /** This event is triggered when the Set InHome Status Button in the config form is clicked */
  SetInhomeServerStatusButtonClick: "onSetInhomeServerStatusButtonClick",
  /** @member {string} */
  /** This event is triggered when skip advertisement/period in multiperiod stream */
  SkipAdvertisementButtonClick: "onSkipAdButtonClick",
  /** @member {string} */
  /** This event is triggered when receiver appId is changed */
  ReceiverAppIdChange: "onReceiverAppIdChange",
  /** @member {string} */
  /** This event is triggered when playback quality is selected */
  PlaybackQualitySelect: "onPlaybackQualitySelect"
};
Object.freeze(WMCChromeCastSenderEvent);

//--------
let receiverAppID = localStorage.getItem('receiverAppID') ? localStorage.getItem('receiverAppID') : DEFAULT_RECEIVER_APPID;
document.getElementById('receiver-app-id-input').value = receiverAppID;
document.addEventListener(
  WMCChromeCastSenderEvent.ReceiverAppIdChange,
  function (e) {
    if (castPlayer) {
      receiverAppID = localStorage.getItem('receiverAppID') ? localStorage.getItem('receiverAppID') : DEFAULT_RECEIVER_APPID;
      castPlayer.initializeCastPlayer();
    }
  }.bind(this)
);


/**
 * Cast player object
 * Main variables:
 *  - PlayerHandler object for handling media playback
 *  - Cast player variables for controlling Cast mode media playback
 *  - Current media variables for transition between Cast and local modes
 *  - Current ad variables for controlling UI based on ad playback
 *  - Current live variables for controlling UI based on ad playback
 * @struct @constructor
 */
var CastPlayer = function () {
  /** @type {PlayerHandler} Delegation proxy for media playback */
  this.playerHandler = new PlayerHandler(this);

  /** @type {PLAYER_STATE} A state for media playback */
  this.playerState = PLAYER_STATE.IDLE;

  /**
   * @type {PLAYER_STATE} Player state before switching between local and
   * remote playback.
   */
  this.playerStateBeforeSwitch = null;

  /* Cast player variables */
  /** @type {cast.framework.RemotePlayer} */
  this.remotePlayer = null;
  /** @type {cast.framework.RemotePlayerController} */
  this.remotePlayerController = null;

  /* Local+Remote player variables */
  /** @type {number} A number for current time in seconds. Maintained in media time. */
  this.currentMediaTime = 0;
  /**
   * @type {?number} A number for current duration in seconds. Maintained in media time.
   * Null if duration should not be shown.
   */
  this.mediaDuration = -1;

  /** @type {?number} A timer for tracking progress of media */
  this.timer = null;
  /** @type {function()} Listener for handling current time increments */
  this.incrementMediaTimeHandler = this.incrementMediaTime.bind(this);
  /** @type {function()} Listener to be added/removed for the seek action */
  this.seekMediaListener = this.seekMedia.bind(this);

  /* Local player variables */
  /** @type {number} A number for current media index */
  this.currentMediaIndex = 0;
  /** @type {?Object} media contents from JSON */
  this.mediaContents = null;
  /** @type {boolean} Fullscreen mode on/off */
  this.fullscreen = false;

  /* Remote Player variables */
  /** @type {?chrome.cast.media.MediaInfo} Current mediaInfo */
  this.mediaInfo = null;
  /* Ad variables */
  /**
   * @type {?number} The time in seconds when the break clip becomes skippable.
   * 5 means that the end user can skip this break clip after 5 seconds. If
   * negative or not defined, it means that the current break clip is not skippable.
   */
  this.whenSkippable = null;

  /* Live variables */
  /** @type {?chrome.cast.media.LiveSeekableRange} Seekable range for live content */
  this.liveSeekableRange = null;
  /** @type {boolean} Remote player is playing live content. */
  this.isLiveContent = false;

  //   this.setupLocalPlayer();
  //   this.addVideoThumbs();
  //   this.initializeUI();
};

CastPlayer.prototype.initializeCastPlayer = function () {
  var options = {};

  // Set the receiver application ID to your own (created in the
  // Google Cast Developer Console), or optionally
  // use the chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID
  options.receiverApplicationId = receiverAppID;
  // Auto join policy can be one of the following three:
  // ORIGIN_SCOPED - Auto connect from same appId and page origin
  // TAB_AND_ORIGIN_SCOPED - Auto connect from same appId, page origin, and tab
  // PAGE_SCOPED - No auto connect
  options.autoJoinPolicy = chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED;

  /** The following flag enables Cast Connect(requires Chrome 87 or higher) */
  options.androidReceiverCompatible = true;
  cast.framework.CastContext.getInstance().setOptions(options);
  this.remotePlayer = new cast.framework.RemotePlayer();
  this.remotePlayerController = new cast.framework.RemotePlayerController(this.remotePlayer);
  this.remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
    function (e) {
      this.switchPlayer(e.value);
    }.bind(this)
  );
  cast.framework.CastContext.getInstance().addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, function (e) {
    _sessionStateChanged(e);
  });
};

/**
 * Switch between the remote and local players.
 */
CastPlayer.prototype.switchPlayer = function () {
  this.playerStateBeforeSwitch = this.playerState;

  this.stopProgressTimer();
  this.resetVolumeSlider();

  // Session is active
  if (cast && cast.framework && this.remotePlayer.isConnected) {
    // Pause local playback
    //this.playerHandler.pause();
    this.setupRemotePlayer();
  }
};

/**
 * PlayerHandler
 *
 * This is a handler through which the application will interact
 * with both the RemotePlayer and LocalPlayer. Combining these two into
 * one interface is one approach to the dual-player nature of a Cast
 * Chrome application. Otherwise, the state of the RemotePlayer can be
 * queried at any time to decide whether to interact with the local
 * or remote players.
 *
 * To set the player used, implement the following methods for a target object
 * and call setTarget(target).
 *
 * Methods to implement:
 *  - play()
 *  - pause()
 *  - stop()
 *  - seekTo(time)
 *  - load(mediaIndex)
 *  - isMediaLoaded(mediaIndex)
 *  - prepareToPlay()
 *  - getMediaDuration()
 *  - getCurrentMediaTime()
 *  - setVolume(volumeSliderPosition)
 *  - mute()
 *  - unMute()
 *  - isMuted()
 *  - updateDisplay()
 *  - updateCurrentTimeDisplay()
 *  - updateDurationDisplay()
 *  - setTimeString(element, time)
 */
var PlayerHandler = function (castPlayer) {
  this.target = {};

  this.setTarget = function (target) {
    this.target = target;
  };

  this.play = function () {
    if (castPlayer.playerState == PLAYER_STATE.IDLE ||
      !this.target.isMediaLoaded(castPlayer.currentMediaIndex)) {
      this.load(castPlayer.currentMediaIndex);
      return;
    }

    castPlayer.playerState = PLAYER_STATE.PLAYING;
    this.target.play();
  };

  this.pause = function () {
    this.target.pause();
    castPlayer.playerState = PLAYER_STATE.PAUSED;
  };

  this.stop = function () {
    castPlayer.playerState = PLAYER_STATE.IDLE;
    this.target.stop();
  };

  this.load = function (mediaIndex = null) {
    if (!mediaIndex) {
      mediaIndex = castPlayer.currentMediaIndex;
    }
    castPlayer.playerState = PLAYER_STATE.BUFFERING;
    this.target.load(mediaIndex);
  };

  /**
   * Check if media has been loaded on the target player.
   * @param {number?} mediaIndex The desired media index. If null, verify if
   *  any media is loaded.
   */
  this.isMediaLoaded = function (mediaIndex) {
    return this.target.isMediaLoaded(mediaIndex);
  };

  /**
   * Called after media has been successfully loaded and is ready to start playback.
   * When local, will start playing the video, start the timer, and update the UI.
   * When remote, will set the UI to PLAYING and start the timer to update the
   * UI based on remote playback.
   */
  this.prepareToPlay = function () {
    castPlayer.mediaDuration = this.getMediaDuration();
    castPlayer.playerHandler.updateDurationDisplay();
    castPlayer.playerState = PLAYER_STATE.LOADED;

    this.play();
    castPlayer.startProgressTimer();
    this.updateDisplay();
  };

  this.getCurrentMediaTime = function () {
    return this.target.getCurrentMediaTime();
  };

  this.getMediaDuration = function () {
    return this.target.getMediaDuration();
  };

  this.updateDisplay = function () {
    // Update local variables
    this.currentMediaTime = this.target.getCurrentMediaTime();
    this.mediaDuration = this.target.getMediaDuration();

    this.target.updateDisplay();
  };

  this.updateCurrentTimeDisplay = function () {
    this.target.updateCurrentTimeDisplay();
  };

  this.updateDurationDisplay = function () {
    this.target.updateDurationDisplay();
  };

  /**
   * Determines the correct time string (media or clock) and sets it for the given element.
   */
  this.setTimeString = function (element, time) {
    //this.target.setTimeString(element, time);
  };

  this.setVolume = function (volumeSliderPosition) {
    this.target.setVolume(volumeSliderPosition);
  };

  this.mute = function () {
    this.target.mute();
    document.getElementById('audio_on').style.display = 'none';
    document.getElementById('audio_off').style.display = 'block';
  };

  this.unMute = function () {
    this.target.unMute();
    document.getElementById('audio_on').style.display = 'block';
    document.getElementById('audio_off').style.display = 'none';
  };

  this.isMuted = function () {
    return this.target.isMuted();
  };

  this.seekTo = function (time) {
    this.target.seekTo(time);
  };
};
/**
 * Set the PlayerHandler target to use the remote player
 * Add event listeners for player changes which may occur outside sender app.
 */
CastPlayer.prototype.setupRemotePlayer = function () {
  // Triggers when the media info or the player state changes
  this.remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.MEDIA_INFO_CHANGED,
    function (event) {
      let session = cast.framework.CastContext.getInstance().getCurrentSession();
      if (!session) {
        this.mediaInfo = null;
        this.isLiveContent = false;
        this.playerHandler.updateDisplay();
        return;
      }

      let media = session.getMediaSession();
      if (!media) {
        this.mediaInfo = null;
        this.isLiveContent = false;
        this.playerHandler.updateDisplay();
        return;
      }

      this.mediaInfo = media.media;

      if (this.mediaInfo) {
        this.isLiveContent = (this.mediaInfo.streamType ==
          chrome.cast.media.StreamType.LIVE);
      } else {
        this.isLiveContent = false;
      }

      if (media.playerState == PLAYER_STATE.PLAYING && this.playerState !== PLAYER_STATE.PLAYING) {
        this.playerHandler.prepareToPlay();
      }

      this.removeAdMarkers();
      this.updateAdMarkers();

      this.playerHandler.updateDisplay();
    }.bind(this)
  );

  this.remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.CAN_SEEK_CHANGED,
    function (event) {
      this.enableProgressBar(event.value);
    }.bind(this)
  );

  this.remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.IS_PAUSED_CHANGED,
    function () {
      if (this.remotePlayer.isPaused) {
        this.playerHandler.pause();
      } else if (this.playerState !== PLAYER_STATE.PLAYING) {
        // If currently not playing, start to play.
        // This occurs if starting to play from local, but this check is
        // required if the state is changed remotely.
        this.playerHandler.play();
      }
    }.bind(this)
  );

  this.remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.IS_MUTED_CHANGED,
    function () {
      if (this.remotePlayer.isMuted) {
        this.playerHandler.mute();
      } else {
        this.playerHandler.unMute();
      }
    }.bind(this)
  );

  this.remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.VOLUME_LEVEL_CHANGED,
    function () {
      var newVolume = this.remotePlayer.volumeLevel * FULL_VOLUME_HEIGHT;
      //   var p = document.getElementById('audio_bg_level');
      //   p.style.height = newVolume + 'px';
      //   p.style.marginTop = -newVolume + 'px';
    }.bind(this)
  );

  this.remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.IS_PLAYING_BREAK_CHANGED,
    function (event) {
      this.isPlayingBreak(event.value);
    }.bind(this)
  );

  this.remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.WHEN_SKIPPABLE_CHANGED,
    function (event) {
      this.onWhenSkippableChanged(event.value);
    }.bind(this)
  );

  this.remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.CURRENT_BREAK_CLIP_TIME_CHANGED,
    function (event) {
      this.onCurrentBreakClipTimeChanged(event.value);
    }.bind(this)
  );

  this.remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.BREAK_CLIP_ID_CHANGED,
    function (event) {
      this.onBreakClipIdChanged(event.value);
    }.bind(this)
  );

  this.remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.LIVE_SEEKABLE_RANGE_CHANGED,
    function (event) {
      showLogs({ message: 'LIVE_SEEKABLE_RANGE_CHANGED' });
      this.liveSeekableRange = event.value;
    }.bind(this)
  );

  // This object will implement PlayerHandler callbacks with
  // remotePlayerController, and makes necessary UI updates specific
  // to remote playback.
  var playerTarget = {};

  playerTarget.play = function () {
    if (this.remotePlayer.isPaused) {
      this.remotePlayerController.playOrPause();
    }
  }.bind(this);

  playerTarget.pause = function () {
    if (!this.remotePlayer.isPaused) {
      this.remotePlayerController.playOrPause();
    }
  }.bind(this);

  playerTarget.stop = function () {
    this.remotePlayerController.stop();
  }.bind(this);

  // Load request for local -> remote
  playerTarget.load = function (mediaIndex) {
    let event = new CustomEvent("onCastSessionEstablished", { "detail": 'Sender cast enabled' });
    document.dispatchEvent(event);
  }.bind(this);

  playerTarget.isMediaLoaded = function (mediaIndex) {
    let session = cast.framework.CastContext.getInstance().getCurrentSession();
    if (!session) return false;

    let media = session.getMediaSession();
    if (!media) return false;

    if (media.playerState == PLAYER_STATE.IDLE) {
      return false;
    }

    // No need to verify local mediaIndex content.
    return true;
  }.bind(this);

  /**
   * @return {number?} Current media time for the content. Always returns
   *      media time even if in clock time (conversion done when displaying).
   */
  playerTarget.getCurrentMediaTime = function () {
    if (this.isLiveContent && this.mediaInfo.metadata &&
      this.mediaInfo.metadata.sectionStartTimeInMedia) {
      return this.remotePlayer.currentTime - this.mediaInfo.metadata.sectionStartTimeInMedia;
    } else {
      // VOD and live scenerios where live metadata is not provided.
      return this.remotePlayer.currentTime;
    }
  }.bind(this);

  /**
   * @return {number?} media time duration for the content. Always returns
   *      media time even if in clock time (conversion done when displaying).
   */
  playerTarget.getMediaDuration = function () {
    if (this.isLiveContent) {
      // Scenerios when live metadata is not provided.
      if (this.mediaInfo.metadata == undefined ||
        this.mediaInfo.metadata.sectionDuration == undefined ||
        this.mediaInfo.metadata.sectionStartTimeInMedia == undefined) {
        return null;
      }

      return this.mediaInfo.metadata.sectionDuration;
    } else {
      return this.remotePlayer.duration;
    }
  }.bind(this);

  playerTarget.updateDisplay = function () {
    let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession && castSession.getMediaSession() && castSession.getMediaSession().media) {
      let media = castSession.getMediaSession();
      let mediaInfo = media.media;

      // image placeholder for video view
      var vi = document.getElementById('video_image');
      if (mediaInfo.metadata && mediaInfo.metadata.images &&
        mediaInfo.metadata.images.length > 0) {
        vi.src = mediaInfo.metadata.images[0].url;
      }

      // playerstate view
      //   document.getElementById('playerstate').style.display = 'block';
      //   document.getElementById('playerstatebg').style.display = 'block';
      //   document.getElementById('video_image_overlay').style.display = 'block';

      let mediaTitle = '';
      let mediaEpisodeTitle = '';
      let mediaSubtitle = '';

      if (mediaInfo.metadata) {
        mediaTitle = mediaInfo.metadata.title;
        mediaEpisodeTitle = mediaInfo.metadata.episodeTitle;
        // Append episode title if present
        mediaTitle = mediaEpisodeTitle ? mediaTitle + ': ' + mediaEpisodeTitle : mediaTitle;
        // Do not display mediaTitle if not defined.
        mediaTitle = (mediaTitle) ? mediaTitle + ' ' : '';
        mediaSubtitle = mediaInfo.metadata.subtitle;
        mediaSubtitle = (mediaSubtitle) ? mediaSubtitle + ' ' : '';
      }

      if (DEMO_MODE) {
        document.getElementById('playerstate').innerHTML =
          (ENABLE_LIVE ? 'Live Content ' : 'Sample Video ') + media.playerState + ' on Chromecast';

        // media_info view
        // document.getElementById('media_title').innerHTML = (ENABLE_LIVE ? 'Live Content' : 'Sample Video');
        // document.getElementById('media_subtitle').innerHTML = '';
      } else {
        document.getElementById('playerstate').innerHTML =
          mediaTitle + media.playerState + ' on ' +
          castSession.getCastDevice().friendlyName;

        // media_info view
        // document.getElementById('media_title').innerHTML = mediaTitle;
        // document.getElementById('media_subtitle').innerHTML = mediaSubtitle;
      }

      // live information
      if (mediaInfo.streamType == chrome.cast.media.StreamType.LIVE) {
        this.liveSeekableRange = media.liveSeekableRange;

        // let live_indicator = document.getElementById('live_indicator');
        // live_indicator.style.display = 'block';

        // Display indicator if current time is close to the end of
        // the seekable range.
        if (this.liveSeekableRange && (Math.abs(media.getEstimatedTime() - this.liveSeekableRange.end) < LIVE_INDICATOR_BUFFER)) {
          live_indicator.src = "imagefiles/live_indicator_active.png";
        } else {
          live_indicator.src = "imagefiles/live_indicator_inactive.png";
        }
      } else {
        //document.getElementById('live_indicator').style.display = 'none';
      }
    } else {
      // playerstate view
      //   document.getElementById('playerstate').style.display = 'none';
      //   document.getElementById('playerstatebg').style.display = 'none';
      //   document.getElementById('video_image_overlay').style.display = 'none';

      //   // media_info view
      //   document.getElementById('media_title').innerHTML = "";
      //   document.getElementById('media_subtitle').innerHTML = "";
    }
  }.bind(this);

  playerTarget.updateCurrentTimeDisplay = function () {
    this.playerHandler.setTimeString(document.getElementById('currentTime'), this.playerHandler.getCurrentMediaTime());
  }.bind(this);

  playerTarget.updateDurationDisplay = function () {
    this.playerHandler.setTimeString(document.getElementById('duration'), this.playerHandler.getMediaDuration());
  }.bind(this);

  //   playerTarget.setTimeString = function (element, time) {
  //     let currentTimeString = this.getMediaTimeString(time);

  //     if (this.isLiveContent) {
  //       if (currentTimeString == null) {
  //         element.style.display = 'none';
  //         return;
  //       }

  //       // clock time
  //       if (this.mediaInfo.metadata && this.mediaInfo.metadata.sectionStartAbsoluteTime !== undefined) {
  //         element.style.display = 'flex';
  //         element.innerHTML = this.getClockTimeString(time + this.mediaInfo.metadata.sectionStartAbsoluteTime);
  //       } else {
  //         // media time
  //         element.style.display = 'flex';
  //         element.innerHTML = currentTimeString;
  //       }
  //     } else {
  //       if (currentTimeString !== null) {
  //         element.style.display = 'flex';
  //         element.innerHTML = currentTimeString;
  //       } else {
  //         element.style.display = 'none';
  //       }
  //     }
  //   }.bind(this);

  playerTarget.setVolume = function (volumeSliderPosition) {
    // var currentVolume = this.remotePlayer.volumeLevel;
    // var p = document.getElementById('audio_bg_level');
    // if (volumeSliderPosition < FULL_VOLUME_HEIGHT) {
    //   p.style.height = volumeSliderPosition + 'px';
    //   p.style.marginTop = -volumeSliderPosition + 'px';
    //   currentVolume = volumeSliderPosition / FULL_VOLUME_HEIGHT;
    // } else {
    //   currentVolume = 1;
    // }
    // this.remotePlayer.volumeLevel = currentVolume;
    // this.remotePlayerController.setVolumeLevel();
  }.bind(this);

  playerTarget.mute = function () {
    if (!this.remotePlayer.isMuted) {
      this.remotePlayerController.muteOrUnmute();
    }
  }.bind(this);

  playerTarget.unMute = function () {
    if (this.remotePlayer.isMuted) {
      this.remotePlayerController.muteOrUnmute();
    }
  }.bind(this);

  playerTarget.isMuted = function () {
    return this.remotePlayer.isMuted;
  }.bind(this);

  playerTarget.seekTo = function (time) {
    this.remotePlayer.currentTime = time;
    this.remotePlayerController.seek();
  }.bind(this);

  this.playerHandler.setTarget(playerTarget);

  // Setup remote player properties on setup
  if (this.remotePlayer.isMuted) {
    this.playerHandler.mute();
  }
  this.enableProgressBar(this.remotePlayer.canSeek);
  // The remote player may have had a volume set from previous playback
  var currentVolume = this.remotePlayer.volumeLevel * FULL_VOLUME_HEIGHT;
  //   var p = document.getElementById('audio_bg_level');
  //   p.style.height = currentVolume + 'px';
  //   p.style.marginTop = -currentVolume + 'px';

  // Show media_control
  // document.getElementById('media_control').style.opacity = 0.7;

  this.hideFullscreenButton();

  // If resuming a session, take the remote properties and continue the existing
  // playback. Otherwise, load local content.
  if (cast.framework.CastContext.getInstance().getCurrentSession().getSessionState() ==
    cast.framework.SessionState.SESSION_RESUMED) {
    showLogs({ message: 'Resuming session' });
    this.playerHandler.prepareToPlay();
    // New media has been loaded so the previous ad markers should
    // be removed.
    // this.removeAdMarkers();
    // this.updateAdMarkers();
  } else {
    this.playerHandler.load();
  }
};

/**
 * Callback when media is loaded in local player
 */
CastPlayer.prototype.onMediaLoadedLocally = function () {
  var localPlayer = document.getElementById('video_element');
  localPlayer.currentTime = this.currentMediaTime;

  this.playerHandler.prepareToPlay();
};

/**
 * Select a media content
 * @param {number} mediaIndex A number for media index
 */
CastPlayer.prototype.selectMedia = function (mediaIndex) {
  showLogs({ message: 'Media index selected: ' + mediaIndex });

  this.currentMediaIndex = mediaIndex;
  // Clear currentMediaInfo when playing content from the sender.
  this.playerHandler.currentMediaInfo = undefined;

  // Set video image
  var vi = document.getElementById('video_image');
  vi.src = MEDIA_SOURCE_ROOT + this.mediaContents[mediaIndex]['thumb'];

  // Reset progress bar
  //   var pi = document.getElementById('progress_indicator');
  //   pi.style.marginLeft = '0px';
  //   var progress = document.getElementById('progress');
  //   progress.style.width = '0px';

  let seekable_window = document.getElementById('seekable_window');
  let unseekable_overlay = document.getElementById('unseekable_overlay');
  seekable_window.style.width = PROGRESS_BAR_WIDTH;
  unseekable_overlay.style.width = '0px';

  // Stop timer and reset time displays
  this.stopProgressTimer();
  this.currentMediaTime = 0;
  //   this.playerHandler.setTimeString(document.getElementById('currentTime'), 0);
  //   this.playerHandler.setTimeString(document.getElementById('duration'), 0);

  this.playerState = PLAYER_STATE.IDLE;
  this.playerHandler.play();
};

/**
 * Media seek function
 * @param {Event} event An event object from seek
 */
CastPlayer.prototype.seekMedia = function (event) {
  //   if (this.mediaDuration == null || (cast.framework.CastContext.getInstance().getCurrentSession() && !this.remotePlayer.canSeek)) {
  //     console.log('Error - Not seekable');
  //     return;
  //   }

  //   if (this.isLiveContent && !this.liveSeekableRange) {
  //     console.log('Live content has no seekable range.')
  //     return;
  //   }

  //   var position = parseInt(event.offsetX, 10);
  //   var pi = document.getElementById('progress_indicator');
  //   var progress = document.getElementById('progress');
  //   let seekTime = 0;
  //   let pp = 0;
  //   let pw = 0;
  //   if (event.currentTarget.id == 'progress_indicator') {
  //     seekTime = parseInt(this.currentMediaTime + this.mediaDuration * position /
  //       PROGRESS_BAR_WIDTH, 10);
  //     pp = parseInt(pi.style.marginLeft, 10) + position;
  //     pw = parseInt(progress.style.width, 10) + position;
  //   } else {
  //     seekTime = parseInt(position * this.mediaDuration / PROGRESS_BAR_WIDTH, 10);
  //     pp = position;
  //     pw = position;
  //   }

  //   if (this.playerState === PLAYER_STATE.PLAYING ||
  //     this.playerState === PLAYER_STATE.PAUSED) {
  //     this.currentMediaTime = seekTime;
  //     progress.style.width = pw + 'px';
  //     pi.style.marginLeft = pp + 'px';
  //   }

  //   if (this.isLiveContent) {
  //     seekTime += this.mediaInfo.metadata.sectionStartTimeInMedia;
  //   }

  //   this.playerHandler.seekTo(seekTime);
};

/**
 * Set current player volume
 * @param {Event} mouseEvent
 */
CastPlayer.prototype.setVolume = function (mouseEvent) {
  //   var p = document.getElementById('audio_bg_level');
  //   var pos = 0;
  //   if (mouseEvent.currentTarget.id === 'audio_bg_track') {
  //     pos = FULL_VOLUME_HEIGHT - parseInt(mouseEvent.offsetY, 10);
  //   } else {
  //     pos = parseInt(p.clientHeight, 10) - parseInt(mouseEvent.offsetY, 10);
  //   }
  //   this.playerHandler.setVolume(pos);
};

/**
 * Starts the timer to increment the media progress bar
 */
CastPlayer.prototype.startProgressTimer = function () {
  //   this.stopProgressTimer();

  //   // Start progress timer
  //   this.timer = setInterval(this.incrementMediaTimeHandler, TIMER_STEP);
};

/**
 * Stops the timer to increment the media progress bar
 */
CastPlayer.prototype.stopProgressTimer = function () {
  //   if (this.timer) {
  //     clearInterval(this.timer);
  //     this.timer = null;
  //   }
};

/**
 * Increment media current time depending on remote or local playback
 */
CastPlayer.prototype.incrementMediaTime = function () {
  //   // First sync with the current player's time
  //   this.currentMediaTime = this.playerHandler.getCurrentMediaTime();
  //   this.mediaDuration = this.playerHandler.getMediaDuration();

  //   this.playerHandler.updateDurationDisplay();

  //   if (this.mediaDuration == null || this.currentMediaTime < this.mediaDuration || this.isLiveContent) {
  //     this.playerHandler.updateCurrentTimeDisplay();
  //     this.updateProgressBarByTimer();
  //   } else if (this.mediaDuration > 0) {
  //     this.endPlayback();
  //   }
};


/**
 *  End playback. Called when media ends.
 */
CastPlayer.prototype.endPlayback = function () {
  this.currentMediaTime = 0;
  this.stopProgressTimer();
  this.playerState = PLAYER_STATE.IDLE;
  this.playerHandler.updateDisplay();

  //   document.getElementById('play').style.display = 'block';
  //   document.getElementById('pause').style.display = 'none';
};

/**
 * @param {?number} timestamp Linux timestamp
 * @return {?string} media time string. Null if time is invalid.
 */
CastPlayer.prototype.getMediaTimeString = function (timestamp) {
  //   if (timestamp == undefined || timestamp == null) {
  //     return null;
  //   }

  //   let isNegative = false;
  //   if (timestamp < 0) {
  //     isNegative = true;
  //     timestamp *= -1;
  //   }

  //   let hours = Math.floor(timestamp / 3600);
  //   let minutes = Math.floor((timestamp - (hours * 3600)) / 60);
  //   let seconds = Math.floor(timestamp - (hours * 3600) - (minutes * 60));

  //   if (hours < 10) hours = '0' + hours;
  //   if (minutes < 10) minutes = '0' + minutes;
  //   if (seconds < 10) seconds = '0' + seconds;

  //   return (isNegative ? '-' : '') + hours + ':' + minutes + ':' + seconds;
};

/**
 * @param {number} timestamp Linux timestamp
 * @return {?string} ClockTime string. Null if time is invalid.
 */
CastPlayer.prototype.getClockTimeString = function (timestamp) {
  //   if (!timestamp) return "0:00:00";

  //   let date = new Date(timestamp * 1000);
  //   let hours = date.getHours();
  //   let minutes = date.getMinutes();
  //   let seconds = date.getSeconds();
  //   let ampm = hours >= 12 ? 'PM' : 'AM';
  //   hours = hours % 12;
  //   // Hour '0' should be '12'
  //   hours = hours ? hours : 12;
  //   minutes = ('0' + minutes).slice(-2);
  //   seconds = ('0' + seconds).slice(-2);
  //   let clockTime = hours + ':' + minutes + ':' + seconds + ' ' + ampm;
  //   return clockTime;
};

/**
 * Updates Ad markers in UI
 */
CastPlayer.prototype.updateAdMarkers = function () {
  //   let castSession = cast.framework.CastContext.getInstance().getCurrentSession();
  //   if (!castSession) return;

  //   let media = castSession.getMediaSession();
  //   if (!media) return;

  //   let mediaInfo = media.media;
  //   if (!mediaInfo) return;

  //   let breaks = mediaInfo.breaks;
  //   let contentDuration = mediaInfo.duration;

  //   if (!breaks) {
  //     return;
  //   }

  //   for (var i = 0; i < breaks.length; i++) {
  //     let adBreak = breaks[i];

  //     // Server-side stitched Ads (embedded) are skipped when the position is beyond
  //     // the duration, so they shouldn't be shown with an ad marker on the UI.
  //     if (adBreak.position > contentDuration && adBreak.isEmbedded) {
  //       continue;
  //     }

  //     // Place marker if not already set in position
  //     if (!document.getElementById('ad' + adBreak.position)) {
  //       var div = document.getElementById('progress')
  //       div.innerHTML += '<div class="adMarker" id="ad' + adBreak.position +
  //         '" style="margin-left: ' +
  //         this.adPositionToMargin(adBreak.position, contentDuration) + 'px"></div>';
  //     }
  //   }
};

/**
 * Remove Ad markers in UI
 */
CastPlayer.prototype.removeAdMarkers = function () {
  //   document.querySelectorAll('.adMarker').forEach(function (adMarker) {
  //     adMarker.remove();
  //   });
};

/**
 * Position of the ad marker from the margin
 */
CastPlayer.prototype.adPositionToMargin = function (position, contentDuration) {
  //   // Post-roll
  //   if (position == -1) {
  //     return PROGRESS_BAR_WIDTH;
  //   }

  //   // Client stitched Ads (not embedded) beyond the duration, will play at the
  //   // end of the content.
  //   if (position > contentDuration) {
  //     return PROGRESS_BAR_WIDTH;
  //   }

  //   // Convert Ad position to margin
  //   return (PROGRESS_BAR_WIDTH * position) / contentDuration;
};

/**
 * Handle BREAK_CLIP_ID_CHANGED event
 */
CastPlayer.prototype.onBreakClipIdChanged = function () {
  // Hide skip button when switching to a new breakClip
  //document.getElementById('skip').style.display = 'none';
};

/**
 * Disable progress bar if playing a break.
 */
CastPlayer.prototype.isPlayingBreak = function (isPlayingBreak) {
  //this.enableProgressBar(!isPlayingBreak);
};

/**
 * Handle WHEN_SKIPPABLE_CHANGED event
 */
CastPlayer.prototype.onWhenSkippableChanged = function (whenSkippable) {
  //this.whenSkippable = whenSkippable;
};

/**
 * Handle CURRENT_BREAK_CLIP_TIME_CHANGED event
 */
CastPlayer.prototype.onCurrentBreakClipTimeChanged = function (currentBreakClipTime) {

};

/**
 * Skip the current Ad
 */
CastPlayer.prototype.skipAd = function () {
  this.remotePlayerController.skipAd();
}

/**
 * Enable/disable progress bar
 */
CastPlayer.prototype.enableProgressBar = function (enable) {
}

/**
 * Request full screen mode
 */
CastPlayer.prototype.requestFullScreen = function () {
  // Supports most browsers and their versions
  var element = document.getElementById('video_element');
  var requestMethod =
    element['requestFullScreen'] || element['webkitRequestFullScreen'];

  if (requestMethod) {
    // Native full screen.
    requestMethod.call(element);
    showLogs({ message: 'Requested fullscreen' });
  }
};

/**
 * Exit full screen mode
 */
CastPlayer.prototype.cancelFullScreen = function () {
  // Supports most browsers and their versions.
  var requestMethod =
    document['cancelFullScreen'] || document['webkitCancelFullScreen'];

  if (requestMethod) {
    requestMethod.call(document);
  }
};

/**
 * Exit fullscreen mode by escape
 */
CastPlayer.prototype.fullscreenChangeHandler = function () {
  // this.fullscreen = !this.fullscreen;
};

/**
 * Show expand/collapse fullscreen button
 */
CastPlayer.prototype.showFullscreenButton = function () {
};

/**
 * Hide expand/collapse fullscreen button
 */
CastPlayer.prototype.hideFullscreenButton = function () {

};

/**
 * Show the media control
 */
CastPlayer.prototype.showMediaControl = function () {

};

/**
 * Hide the media control
 */
CastPlayer.prototype.hideMediaControl = function () {
};

/**
 * Show the volume slider
 */
CastPlayer.prototype.showVolumeSlider = function () {
};

/**
 * Hide the volume slider
 */
CastPlayer.prototype.hideVolumeSlider = function () {
};

/**
 * Reset the volume slider
 */
CastPlayer.prototype.resetVolumeSlider = function () {
};

/**
 * Initialize UI components and add event listeners
 */
CastPlayer.prototype.initializeUI = function () {
};

/**
 * Add video thumbnails div's to UI for media JSON contents
 */
CastPlayer.prototype.addVideoThumbs = function () {
};

/**
 * Makes human-readable message from chrome.cast.Error
 * @param {chrome.cast.Error} error
 * @return {string} error message
 */
CastPlayer.getErrorMessage = function (error) {
  switch (error.code) {
    case chrome.cast.ErrorCode.API_NOT_INITIALIZED:
      return 'The API is not initialized.' +
        (error.description ? ' :' + error.description : '');
    case chrome.cast.ErrorCode.CANCEL:
      return 'The operation was canceled by the user' +
        (error.description ? ' :' + error.description : '');
    case chrome.cast.ErrorCode.CHANNEL_ERROR:
      return 'A channel to the receiver is not available.' +
        (error.description ? ' :' + error.description : '');
    case chrome.cast.ErrorCode.EXTENSION_MISSING:
      return 'The Cast extension is not available.' +
        (error.description ? ' :' + error.description : '');
    case chrome.cast.ErrorCode.INVALID_PARAMETER:
      return 'The parameters to the operation were not valid.' +
        (error.description ? ' :' + error.description : '');
    case chrome.cast.ErrorCode.RECEIVER_UNAVAILABLE:
      return 'No receiver was compatible with the session request.' +
        (error.description ? ' :' + error.description : '');
    case chrome.cast.ErrorCode.SESSION_ERROR:
      return 'A session could not be created, or a session was invalid.' +
        (error.description ? ' :' + error.description : '');
    case chrome.cast.ErrorCode.TIMEOUT:
      return 'The operation timed out.' +
        (error.description ? ' :' + error.description : '');
    default:
      return error;
  }
};

let wmcUIMgr = new WMCRefAppUIManager();
let configParams = wmcUIMgr.getConfigParams();
let castPlayer = new CastPlayer();

let videoPosition = 0;
let videoDuration = 0;
let programInfo = null;
let timeshiftEnabled = false;
let castSessionState = null;

function _sessionStateChanged(event) {
  castSessionState = event.sessionState;
  showLogs({ message: "sessionStateChanged - EVENT:" + JSON.stringify(event) });
  switch (event.sessionState) {
    case cast.framework.SessionState.SESSION_STARTING:
      break;
    case cast.framework.SessionState.NO_SESSION:
    case cast.framework.SessionState.SESSION_START_FAILED:
    case cast.framework.SessionState.SESSION_ENDED:
      let event = new CustomEvent("onCastSessionDisconnect", { "detail": "Cast Sesssion Disconnect" });
      document.dispatchEvent(event);
      break;
    case cast.framework.SessionState.SESSION_RESUMED:
    case cast.framework.SessionState.SESSION_STARTED:
      _onSessionCreated(cast.framework.CastContext.getInstance().getCurrentSession());
      break;
    default:
  }
}

function _onSessionCreated(castSession) {
  if (castSession) {
    castSession.addMessageListener('urn:x-cast:com.mediakind.cast.media',
      _onReceiverMessageReceived);
    // console.log("CastSender: Session Started with application ID: " + castMgr.isCastSessionAlive().ga.applicationId);
  }
}

/****************************Cast Command***********************************/
class CastSenderManager {
  isBrowserSupported() {
    const userAgent = window.navigator.userAgent.toLowerCase();
    // Chrome 1 - 79
    const isChrome = userAgent.indexOf("chrome") > -1 && !!window.chrome;
    // Edge (based on chromium) detection
    const isEdgeChromium = isChrome && userAgent.indexOf("edg") > -1;
    return isChrome || isEdgeChromium;
  }

  isCastSessionAlive() {
    if (this.isBrowserSupported() && cast && typeof (cast) === "object") {
      return (cast && cast.framework && cast.framework.CastContext.getInstance().getCurrentSession());
    }
    return false;
  }

  castSenderPlayerEvent(eventType, eventData) {
    if (!eventType) {
      showLogs({
        message: "Cast Failed! No sender event received.",
        type: 'error'
      });
      return;
    }

    let cmd = null;
    configParams = wmcUIMgr.getConfigParams();

    switch (eventType) {
      case WMCChromeCastSenderEvent.PlayClick:
        if (configParams && configParams.serverUrl.trim().length === 0) {
          showLogs({
            message: "Cast Failed! Server Url should not be empty.",
            type: 'error'
          });
          return;
        }
        if (configParams && configParams.primaryAccount.trim().length === 0) {
          showLogs({
            message: "Cast Failed! Primary Account should not be empty.",
            type: 'error'
          });
          return;
        }
        if (configParams && configParams.mediaUid.trim().length === 0) {
          showLogs({
            message: "Cast Failed! Media Uid should not be empty.",
            type: 'error'
          });
          return;
        }
        if (configParams && configParams.stsToken.trim().length === 0) {
          showLogs({
            message: "Cast Failed! STS Token should not be empty.",
            type: 'error'
          });
          return;
        }
        var bufferData = null;
        if (configParams && (configParams.hasOwnProperty("forwardBuffer") || configParams.hasOwnProperty("backwardBuffer"))) {
          var bufferData = {
            forwardDuration: (configParams.forwardBuffer !== ""
              && configParams.forwardBuffer !== undefined
              && configParams.forwardBuffer !== null) ? configParams.forwardBuffer : NaN,
            backwardDuration: (configParams.backwardBuffer !== ""
              && configParams.backwardBuffer !== undefined
              && configParams.backwardBuffer !== null) ? configParams.backwardBuffer : NaN
          }
        }

        cmd = {
          "commandData": {
            "appToken": configParams.appToken,
            "isCCenabled": wmcUIMgr.getClosedCaptionsState(),
            "cdnProfile": "",
            "cdnUrl": "",
            "forceRegister": false,
            "logLevel": wmcUIMgr.getLogLevel(),
            "maxBandwidth": 0,
            "mediaUid": configParams.mediaUid,
            "metadataInfo": "{\"playbackType\":\"LiveTV\",\"title\":\"Dateline\",\"programName\":\"KRON-4 (MY NETWORK TV)\",\"releaseYear\":\"\",\"rating\":\"\",\"posterImageUri\":\"https://ottapp-appgw-client-a.cid.mr.tv3cloud.com/htmlapp/20191206-e645927-25-s116-mr-int/images/Genre/movie_placeholder_116x87.jpg\",\"startTimeUtc\":1576134000000,\"endTimeUtc\":1576137600000,\"duration\":0,\"isAdult\":false,\"isPCONEnabled\":false,\"entitlements\":[\"ct\",\"rw\"],\"episodes\":[{\"seasonId\":\"series_3623501_40233_DefaultSeason\",\"episodeId\":\"303\",\"name\":\"A Crack in Everything\",\"startTime\":1576134000000,\"endTime\":1576137600000,\"duration\":0}]}",
            "minBandwidth": 0,
            "mode": configParams.playbackMode === 'VOD' ? 0 : 1,
            "ownerUid": "azuki",
            "primary": configParams.primaryAccount,
            "requestUrl": configParams.serverUrl,
            "sessionUid": "",
            "startBandwidth": 5120,
            "stsToken": configParams.stsToken,
            "tenantId": "default",
            "userToken": configParams.primaryAccount,
            "transcodeFormat": "",
            "setStartTime": "",
            "startBookmark": eventData, // bug 1306691: sending startbookmark incase playback needs to start from a position
            "isDvr": configParams.isDVR,
            "bufferData": bufferData,
            "startupThreshold": configParams.startupThreshold,
            "restartThreshold": configParams.restartThreshold
          },
          "commandType": "init"
        }
        videoDuration = 0;
        videoPosition = 0;
        programInfo = null;
        break;

      case WMCChromeCastSenderEvent.PauseClick:
        cmd = {
          "commandType": "pause"
        };
        break;

      case WMCChromeCastSenderEvent.StopClick:
        cmd = {
          "commandType": "stop"
        };
        videoDuration = 0;
        videoPosition = 0;
        programInfo = null;
        break;

      case WMCChromeCastSenderEvent.ResumeClick:
        cmd = {
          "commandType": "resume"
        };
        break;

      case WMCChromeCastSenderEvent.SeekClick:
        cmd = {
          "commandData": eventData,
          "commandType": "seek"
        };
        break;

      case WMCChromeCastSenderEvent.LiveNowClick:
        cmd = {
          "commandType": "liveNow"
        };
        break;

      case WMCChromeCastSenderEvent.VolumeToggleClick:
        cmd = {
          "commandData": eventData,
          "commandType": "setMute"
        };
        break;

      case WMCChromeCastSenderEvent.VolumeSliderPositionChange:
        cmd = {
          "commandData": eventData,
          "commandType": "setVolume"
        };
        break;

      case WMCChromeCastSenderEvent.AudioTrackSelect:
        cmd = {
          "commandData": eventData,
          "commandType": "setAudio"
        };
        break;

      case WMCChromeCastSenderEvent.PlaybackSpeedSelect:
        cmd = {
          "commandData": eventData,
          "commandType": "setPlaySpeed"
        };
        break;

      case WMCChromeCastSenderEvent.PlaybackQualitySelect:
        cmd = {
          "commandData": eventData,
          "commandType": "setVideoQuality"
        };
        break;

      case WMCChromeCastSenderEvent.SubtitleTrackSelect:
        cmd = {
          "commandData": eventData,
          "commandType": "setSubtitle"
        };
        break;

      case WMCChromeCastSenderEvent.CCToggle:
        cmd = {
          "commandData": eventData,
          "commandType": "enableCC"
        };
        break;

      case WMCChromeCastSenderEvent.LogLevelSelect:
        cmd = {
          "commandData": eventData,
          "commandType": "setLogLevel"
        };
        break;
    }
    return this.sendChromecastMessage(cmd);
  }

  sendChromecastMessage(message) {

    var activeSession = cast.framework.CastContext.getInstance().getCurrentSession();
    if (!activeSession) {
      showLogs({
        message: "Error: Session is not ready",
        type: 'error'
      });
      return;
    }
    showLogs({
      message: 'Cast Sender: Message send to receiver ' + JSON.stringify(message),
      type: 'info'
    });
    let command = JSON.stringify(message);
    return activeSession.sendMessage('urn:x-cast:com.mediakind.cast.media', command
    ).then(function (e) {
      return true;
    }).catch(error => {
      showLogs({
        message: "Error sending message:" + JSON.stringify(error),
        type: 'warn'
      });
      return false;
    });
  }

  getCurrentCastVideoPosition() {
    return { videoPosition, videoDuration };
  }

  getCastSessionState() {
    return castSessionState;
  }
}

function showLogs(options = {}) {
  let code, message, type;
  if (options) {
    code = options.code ?? options.code;
    message = options.message ?? options.message;
    type = options.type ? options.type : 'basic';
  }
  wmcUIMgr.showConsoleInfo({
    TAG: 'WMCChromeCastSender',
    code,
    message,
    type
  });
  if (options.type === 'error') {
    wmcUIMgr.showErrorMessage(code, message);
    wmcUIMgr.resetControls();
  }
}

function _onReceiverMessageReceived(namespace, message) {
  if (message && typeof message === 'string') {
    message = JSON.parse(message);

    let msgType = 'info';
    switch (message.eventType) {
      case "onVideoPositionChanged":
        videoPosition = message.eventData.videoPosition;
        videoDuration = message.eventData.videoDuration;
        let currentVideoDuration = message.eventData.videoDuration;
        let bufferLength = message.eventData.bufferLength;
        timeshiftEnabled = message.eventData.timeshiftEnabled;
        if (wmcPlayerConfig.playbackMode === "LIVE" && timeshiftEnabled) {
          if (programInfo && programInfo.duration) {
            videoDuration = programInfo.duration / 1000; // total program duration for live
          }

          let liveGapDuration = videoPosition && currentVideoDuration && (currentVideoDuration - videoPosition);
          if (liveGapDuration && liveGapDuration > SHOW_LIVE_NOW && !wmcUIMgr.isLiveNowButtonVisible()) {
            wmcUIMgr.showLiveNowButton(true);
            wmcUIMgr.toastMessage("You are now behind the live, click the 'LiveNow' button to return to Live!");
          }
        }

        // we will consider the minimum of video and audio buffer length for our calculations
        bufferLength = Math.min(bufferLength.video, bufferLength.audio);

        wmcUIMgr.updateVideoPosition(videoPosition, videoDuration, bufferLength)
        msgType = 'debug';
        break;
      case "onStateChanged":
        switch (message.eventData.stateCode) {
          case AmcConstants.IMC_STATE_PLAY_STARTED:
            wmcUIMgr.showSpinner(false);
            wmcUIMgr.showPauseIcon();
            let audioTracks = message.eventData.stateData.audioTracks;
            let subtitleList = message.eventData.stateData.subtitleList;
            programInfo = message.eventData.stateData.programInfo;
            if (programInfo && programInfo.start && programInfo.duration) {
              const startTime = new Date(programInfo.start);
              const endTime = new Date(startTime.getTime() + programInfo.duration);

              // update the program start and end time on the controls
              wmcUIMgr.updateProgramTime(startTime, endTime);
            }
            if (audioTracks && audioTracks.length) {
              wmcUIMgr.populateAudioTracks(message.eventData.stateData)
            }
            if (subtitleList && subtitleList.length) {
              wmcUIMgr.populateSubtitleTracks(subtitleList)
            }
            if (wmcUIMgr.isLiveNowButtonVisible() && wmcPlayerConfig.playbackMode === "LIVE") {
              setTimeout(() => {
                wmcUIMgr.triggerEvent(WMCRefAppUIManagerEvent.LiveNowClick);
              }, 2000);
            }
            break;
          case AmcConstants.IMC_STATE_PLAY_PAUSED:
            if (wmcPlayerConfig.playbackMode === "LIVE" && timeshiftEnabled && !wmcUIMgr.isLiveNowButtonVisible()) {
              wmcUIMgr.showLiveNowButton(true);
              wmcUIMgr.toastMessage("You are now in live timeshift mode, click the 'LiveNow' button to return to Live!");
            }
            break;
          case AmcConstants.IMC_STATE_BUFFERING_STARTED:
            wmcUIMgr.showSpinner(true);
            break;
          case AmcConstants.IMC_STATE_BUFFERING_STOPPED:
            wmcUIMgr.showSpinner(false);
            break;
          case AmcConstants.IMC_STATE_DONE:
            wmcUIMgr.showSpinner(false);
            wmcUIMgr.resetControls();
            wmcUIMgr.showControls(true);
            break;
          default:
            break;
        }
        let event = new CustomEvent("updateCastPlayerState", { "detail": message.eventData.stateCode });
        document.dispatchEvent(event);
        break;
      case "onTextTracksAdded":
        wmcUIMgr.populateSubtitleTracks(message.eventData.subtitleList, message.eventData.currentSubTitle);
        break;
      case "onError":
        showLogs({
          code: message.eventData.code,
          message: message.eventData.message,
          type: 'error'
        });
        return;
      default:
        break;
    }
    // console.warn('Cast Sender: Received Messages', message);
    showLogs({
      message: `Cast Sender: Received Messages ${JSON.stringify(message)}`,
      type: msgType
    });
  }
}

window['__onGCastApiAvailable'] = function (isAvailable) {
  if (isAvailable) {
    castPlayer.initializeCastPlayer();
  }
};

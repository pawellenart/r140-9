"use strict";

if (!amc) {
    throw "AMC library is not loaded yet!";
}

const {
    AmcEvents,
    AmcManager,
    AmcConstants
} = amc;

const WMCRefApp_TAG = "[WMCRefApp]";
const SHOW_LIVE_NOW = 10 // in seconds;
const HEADER_TEXT = "WMC-SDK";

/**
 * @summary WMCRefAppConstants
 * @description WMCRefApp Contant values
 * @readonly
 * @enum {number}
 */
const WMCRefAppConstants = {
    /** @member {number} */
    /** Indicates the amount of time value in seconds used for a skipBack operation */
    SkipBackSeconds: 7,
    /** @member {number} */
    /** Indicates the amount of time value in seconds used for a skipForward operation */
    SkipForwardSeconds: 30
};
Object.freeze(WMCRefAppConstants);

/**
 * @summary
 * WMCRefApp Player States
 * @readonly
 * @enum {string}
 */
const WMCRefAppPlayerState = {
    /** @member {string} */
    /** Player is in idle state (a state before playback session has started and also after playback session ends) */
    Idle: "Idle",
    /** @member {string} */
    /** Player has started loading the asset */
    Loading: "Loading",
    /** @member {string} */
    /** Player is in playing state */
    Playing: "Playing",
    /** @member {string} */
    /** Player is in paused state */
    Paused: "Paused",
    /** @member {string} */
    /** Player is in seeking state */
    Seeking: "Seeking"
};

/* content advisory audio and poster image (sample audio and poster image - path's relative to index.html) */
const SampleContentAdvisoryPosterImage = "./resources/content_advisory/ca_poster.png";
const SampleContentAdvisoryAudioSource = "./resources/content_advisory/audio_advisory_R_en.mp3";
/* handle to the chrome cast manager */
let castMgr = null
/* handle to the ui manager */
let uiMgr = null;

/* handle to the wmc player */
let wmcPlayer = null;

/* helper flag to indicate that a new source is available for playback after the current playback session has been cleaned up */
let playNext = false;

/* the current player configuration parameters in use by the player */
let wmcPlayerConfig = {};

/* the current wmc player's state */
let wmcPlayerState = WMCRefAppPlayerState.Idle;

/* player load time - the time when playback start is called */
let loadTime = 0;
let backendModulesStartupTime = 0;
let bitmovinLoadTime = 0;
let bitmovinRenderTime = 0;

let playBackControlRestrictions = [];

let seekableRange = null;

const isSeekableRange = false;
let isExternalSource = false;

let adElapsedTime = 0;
let adElapsedInterval = null;

/**
 * @summary
 * Heler function to log the player state change and update the current player state.
 *
 * @param {WMCRefAppPlayerState} toState the player state that the player will be transitioning to
 */
function updatePlayerState(toState) {
    if (wmcPlayerState !== toState) {
        console.log(WMCRefApp_TAG, `UpdatePlayerState: ${wmcPlayerState} ➸ ${toState}`);
        wmcPlayerState = toState;

        // update the metrics to reflect the current state of the player
        uiMgr.updatePlayerMetrics({ playerState: wmcPlayerState });
    }
}

/**
 * @summary
 * WMCRefApp's event handler for all player events.
 *
 * @description
 * This is the main event handler for all events received from the player.
 *
 * @param {object} eventObj an object containing event specific data
 */
function onPlayerEvent(eventObj) {
    const eventType = eventObj.eventType;
    switch (eventType) {
        /* These events are received as a result of a call to wmcPlayer.init() */
        case AmcEvents.AMC_EVENT_INIT_COMPLETE:
        case AmcEvents.AMC_EVENT_DEVICE_REGISTERED:
            wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_INIT_COMPLETE, onPlayerEvent);
            wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_DEVICE_REGISTERED, onPlayerEvent);

            // to indicate loading, update state and start showing spinner
            updatePlayerState(WMCRefAppPlayerState.Loading);
            uiMgr.showSpinner(true);
            // create the wmc player and load the source parameters now.
            wmcPlayer.createPlayer(wmcPlayerConfig.playbackMode === "LIVE" ? AmcConstants.IMC_MODE_LIVE : AmcConstants.IMC_MODE_ADAPTIVE,
                wmcPlayerConfig.mediaUid, wmcPlayerConfig.appToken);
            break;

        /* This event is received as a result of call to wmcPlayer.createPlayer(), loading has completed, ready to start playback */
        case AmcEvents.AMC_EVENT_PLAY_READY:
            wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_PLAY_READY, onPlayerEvent);

            // Note: we will remain in loading state until playback starts!

            if (wmcPlayerConfig.playbackMode === "VOD" && wmcPlayerConfig.contentAdvisoryEnabled) {
                const audioElement = uiMgr.getAudioElement();
                if (audioElement) {
                    // now that preloading has completed, we will first put up the
                    // CA poster image and play the CA audio in the background, and
                    // before we play CA, hide the spinner and update the play pause
                    // icon to display pause icon. Note: none of these player controls
                    // will work when CA audio is playing - we want this audio heard,
                    // so we hide the controls too.
                    uiMgr.showContentPoster(SampleContentAdvisoryPosterImage);
                    uiMgr.showControls(false);
                    uiMgr.showSpinner(false);
                    uiMgr.showPauseIcon();

                    // wait for the CA audio to end
                    audioElement.onended = function () {
                        // now we pull down the CA poster image and start the actual asset playback.
                        uiMgr.clearContentPoster();
                        //wmcPlayer.start();
                        _startPlayBack();
                    }

                    // set the content advisory audio source and start the audio playback
                    audioElement.src = SampleContentAdvisoryAudioSource;
                    audioElement.play();

                    // safe to update the player state to playing as CA audio has started playing
                    updatePlayerState(WMCRefAppPlayerState.Playing);
                } else {
                    console.log(WMCRefApp_TAG, "Preload completed, but no proper audio source configured, so starting playback!");
                    //wmcPlayer.start();
                    _startPlayBack();
                }
            } else {
                // start playback (new playback session)
                // wmcPlayer.start();
                _startPlayBack();
            }
            break;

        /* This event is received for Live services only and contains information related to current program */
        case AmcEvents.AMC_EVENT_PROGRAM_CHANGED:
            const programInfo = eventObj.value1;
            if (programInfo && programInfo.start && programInfo.duration) {
                const startTime = new Date(programInfo.start);
                const endTime = new Date(startTime.getTime() + programInfo.duration);

                // update the program start and end time on the controls
                uiMgr.updateProgramTime(startTime, endTime);
                uiMgr.showConsoleInfo({
                    message: programInfo.pid,
                    type: 'info'
                });
            }
            break;

        /* This event is received periodically with information related to current position and program duration */
        case AmcEvents.AMC_EVENT_VIDEO_POSITION_CHANGED:
            let videoPosition = eventObj.videoPosition;
            let videoDuration = eventObj.videoDuration;
            let currentVideoDuration = eventObj.videoDuration;
            let bufferLength = wmcPlayer.getBufferLength();
            // update the player metrics
            uiMgr.updatePlayerMetrics({
                videoBufferLength: bufferLength.video,
                audioBufferLength: bufferLength.audio
            });

            // we will consider the minimum of video and audio buffer length for our calculations
            bufferLength = Math.min(bufferLength.video, bufferLength.audio);

            if (wmcPlayerConfig.playbackMode === "LIVE" && wmcPlayer.timeshiftEnabled() || wmcPlayer.isLiveEvent()) {
                if (!wmcPlayer.isLiveEvent()) {
                    const programInfo = wmcPlayer.getProgramInfo();
                    if (programInfo && programInfo.duration) {
                        videoDuration = programInfo.duration / 1000;
                    }
                }

                let liveGapDuration = (currentVideoDuration - videoPosition);
                if (currentVideoDuration && videoPosition && liveGapDuration && liveGapDuration > SHOW_LIVE_NOW && !uiMgr.isLiveNowButtonVisible()) {
                    uiMgr.showLiveNowButton(true);
                    uiMgr.toastMessage("You are now behind the live, click the 'LiveNow' button to return to Live!");
                }
            }

            if (isExternalSource && wmcPlayerConfig.playbackMode === "LIVE" && !wmcPlayer.isLiveEvent()) {
                uiMgr.updateProgramTime(new Date(wmcPlayer.getSeekableRange().start * 1000), new Date(wmcPlayer.getSeekableRange().end * 1000));
                videoPosition = wmcPlayer.getCurrentTime('absolutetime') - wmcPlayer.getSeekableRange().start;
                videoDuration = wmcPlayer.getSeekableRange().duration;
                bufferLength = 0;
                if (videoPosition < 0) {
                    videoDuration += -videoPosition;
                    videoPosition = 0;
                }
            }
            // update the position, buffer level and duration in the UI
            if (!castMgr || (castMgr && !castMgr.isCastSessionAlive())) {
                uiMgr.updateVideoPosition(videoPosition, videoDuration, bufferLength);
            }
            break;

        /* This event is received whenever there is a player state change */
        case AmcEvents.AMC_EVENT_STATE_CHANGED:
            const state = eventObj.value1;
            switch (state) {
                /* Indicates that the playback (a new playback session) has started */
                case AmcConstants.IMC_STATE_PLAY_STARTED:
                    //set player header
                    uiMgr.updatePlayerHeaderText(HEADER_TEXT + '-' + wmcPlayer.getAmcVersion() + '-' + wmcPlayer.getAmcPlayerDetails());

                    updatePlayerState(WMCRefAppPlayerState.Playing);

                    // update the player metrics player startup time - time it took to start playback!
                    let startupTime = new Date(Date.now() - loadTime);
                    startupTime = startupTime.getSeconds() + "." + startupTime.getMilliseconds();

                    // get the available audio and subtitle tracks
                    const audioTracks = wmcPlayer.getAudioTracks();
                    const subtitleTracks = wmcPlayer.getSubtitles();
                    // get the available playback video qualities
                    const availableVideoQualities = wmcPlayer.getAvailableVideoQualities();

                    // restore CC and playSpeed if the values were changed when the player was Idle
                    wmcPlayer.enableCC(uiMgr.getClosedCaptionsState());
                    wmcPlayer.setPlaySpeed(uiMgr.getPlaybackSpeed());

                    // set the UI in order for the new playback session
                    uiMgr.showPauseIcon();
                    uiMgr.showSpinner(false);
                    uiMgr.clearContentPoster();
                    uiMgr.showLiveNowButton(false);
                    uiMgr.populateAudioTracks(audioTracks);
                    uiMgr.populateSubtitleTracks(subtitleTracks);

                    // populate the video quality list
                    uiMgr.populateVideoQualities(availableVideoQualities);

                    // update the player metrics
                    uiMgr.updatePlayerMetrics({
                        startupTime: startupTime,
                        audioTracks: audioTracks,
                        subtitleTracks: {
                            subtitleTracks: subtitleTracks,
                            currentSubtitleTrack: "off" // this is the default state on start!
                        }
                    });
                    break;

                /* Indicates that the playback has resumed after either a Pause or Seek operation */
                case AmcConstants.IMC_STATE_PLAY_RESUMED:
                    updatePlayerState(WMCRefAppPlayerState.Playing);
                    uiMgr.showPauseIcon();
                    uiMgr.showSpinner(false);
                    break;

                /* Indicates that the playback has paused */
                case AmcConstants.IMC_STATE_PLAY_PAUSED:
                    updatePlayerState(WMCRefAppPlayerState.Paused);
                    if (wmcPlayerConfig.playbackMode === "LIVE" && wmcPlayer.timeshiftEnabled() && !uiMgr.isLiveNowButtonVisible()) {
                        uiMgr.showLiveNowButton(true);
                        uiMgr.toastMessage("You are now in live timeshift mode, click the 'LiveNow' button to return to Live!");
                    }
                    uiMgr.showPlayIcon();
                    uiMgr.showSpinner(false);
                    break;

                /* Indicates that the player is performing a seek operation (seek has started) */
                case AmcConstants.IMC_STATE_SEEKING:
                    updatePlayerState(WMCRefAppPlayerState.Seeking);
                    uiMgr.showSpinner(true);
                    uiMgr.disableSeekControls(true);
                    break;

                /* Indicates that the player has stalled */
                case AmcConstants.IMC_STATE_BUFFERING_STARTED:
                    uiMgr.updatePlayerMetrics({ playerState: "Stalled" });
                    uiMgr.showSpinner(true);
                    break;

                /* Indicates that the player has recovered from a stall and resumed */
                case AmcConstants.IMC_STATE_BUFFERING_STOPPED:
                    uiMgr.updatePlayerMetrics({ playerState: wmcPlayerState }); // wmcPlayerState to restore the correct player state before Stall started
                    uiMgr.showSpinner(false);
                    break;

                /* Indicates that playback has reched the end of duration for the current program */
                case AmcConstants.IMC_STATE_PLAY_COMPLETED:
                    _stopPlayBack();
                    break;

                /* Indicates that the current playback session has come to an end */
                case AmcConstants.IMC_STATE_DONE:
                    // clean up the current playback session
                    updatePlayerState(WMCRefAppPlayerState.Idle);
                    unregisterEventListeners();
                    uiMgr.resetControls();
                    uiMgr.showControls(true);
                    wmcPlayer = null;
                    // play the next source if it is available
                    if (playNext) {
                        playNext = false;
                        onPlayPause();
                    }
                    break;
            }
            break;

        /* This event is received to indicate that the ongoing seek operation has ended */
        case AmcEvents.AMC_EVENT_SEEK_COMPLETE:
            uiMgr.updatePlayerMetrics({ playerState: wmcPlayerState }); // wmcPlayerState to restore the correct player state before Seek started
            if (wmcPlayerConfig.playbackMode === "LIVE" && wmcPlayer.timeshiftEnabled() && !uiMgr.isLiveNowButtonVisible()) {
                uiMgr.showLiveNowButton(true);
                uiMgr.toastMessage("You are now behind the live, click the 'LiveNow' button to return to Live!");
            }
            uiMgr.showSpinner(false);
            uiMgr.disableSeekControls(false);
            break;

        /* This event is received whenever an error or playback restriction occurs with data related to the cause of error */
        case AmcEvents.AMC_EVENT_ERROR:
            const errorMessage = eventObj.message;
            const errorCode = parseInt(eventObj.code, 10);

            // DRM PBR restrictions - not errors - so display toast notification
            if (errorCode >= 224 && errorCode <= 231 && errorMessage) {
                uiMgr.toastMessage(errorMessage);
                uiMgr.showConsoleInfo({
                    code: errorCode,
                    message: errorMessage,
                    type: 'warn'
                });
            } else { // fatal error - show the relevant error code/message and stop the playback session.
                uiMgr.showErrorMessage(errorCode, errorMessage);
                _stopPlayBack();
            }
            uiMgr.toggleTimeShiftControlVisibility(false, true);
            blockControls();
            break;

        /* This event is received during an ongoing playback when the current video bitrate changes (due to ABR selection) */
        case AmcEvents.AMC_EVENT_BIT_RATE_CHANGED:
            uiMgr.updatePlayerMetrics({
                videoQualities: {
                    availableQualitites: wmcPlayer.getBandwidthList(),
                    currentQuality: eventObj.value1 // the current video quality
                }
            });
            break;

        /* This event is received when get AD Marker data */
        case AmcEvents.AMC_EVENT_AD_MARKER_DATA:
            uiMgr.updateAdMarkersValue(eventObj.value1 ? eventObj.value1 : null, wmcPlayer.getVideoDuration(), (wmcPlayerConfig.playbackMode === "LIVE"));
            break;

        /* This event is received whenever an event stream is encountered (typically contains DAI Ad Tracking Url for MKP streams in the message data) */
        case AmcEvents.AMC_EVENT_AD_STARTED:
        case AmcEvents.AMC_EVENT_AD_QUARTILE:
        case AmcEvents.AMC_EVENT_AD_FINISHED:
            if (wmcPlayerConfig.playbackMode === "LIVE" && wmcPlayer.timeshiftEnabled()) {
                if (eventType === AmcEvents.AMC_EVENT_AD_STARTED) {
                    adElapsedInterval = setInterval(() => {
                        adElapsedTime += 1 / 4;
                    }, 250);
                }
                if (eventType === AmcEvents.AMC_EVENT_AD_FINISHED) {
                    clearInterval(adElapsedInterval);
                }
            }
            const eventStreamData = eventObj.value1;
            if (eventStreamData) {
                const msg = `AD_QUARTILE type: ${eventStreamData.type}, event at: ${(wmcPlayerConfig.playbackMode === "LIVE") ? new Date(eventStreamData.start * 1000).toISOString().substr(11, 8) : eventStreamData.start.toFixed(2)}, render on: ${(wmcPlayerConfig.playbackMode === "LIVE") ? new Date(eventStreamData.time * 1000).toISOString().substr(11, 8) : eventStreamData.time.toFixed(2)}`;
                // display the ad stages as a toast message for 1 seconds each
                //uiMgr.toastMessage(msg, 1000);
                uiMgr.updateADEventLogs(`${WMCRefApp_TAG} ${msg}`, eventStreamData.type.toLowerCase() === 'complete' ? true : false);
                uiMgr.updateEventStreams({ id: eventStreamData.id.toString(), message: eventStreamData.type, isLive: (wmcPlayerConfig.playbackMode === "LIVE"), playerCurrentTime: wmcPlayer.getCurrentTime() });
            }
            break;
        case AmcEvents.AMC_EVENT_AD_BREAK:
            uiMgr.toastMessage(eventObj.value1.type, 3000);
            console.log(WMCRefApp_TAG, "Received Ad Break event from player: ", eventObj.value1);
            break;
        /* This event is received whenever metadata is encountered in the stream. the types of metadata are defined in AmcConstants.IMC_PLAYER_METADATA_TYPE_ */
        case AmcEvents.AMC_EVENT_PLAYER_METADATA:
            const playerMetadata = eventObj.value1;
            console.log(WMCRefApp_TAG, "Received metadata from player: " + JSON.stringify(playerMetadata, null, 4));
            break;

        /* This event is received when audio track changes to reflect the current selection */
        case AmcEvents.AMC_EVENT_AUDIO_TRACKS_CHANGED:
            // just update the player metrics to reflect the current selection
            uiMgr.updatePlayerMetrics({
                audioTracks: eventObj.value1 // available audio tracks and current audio track
            });
            uiMgr.populateAudioTracks(eventObj.value1);
            break;

        /* This event is received when subtitle track changes to reflect the current selection */
        case AmcEvents.AMC_EVENT_TEXT_TRACKS_ADDED:
            uiMgr.populateSubtitleTracks(eventObj.value1.subtitleTracks, eventObj.value1.currentSubtitleTrack);
        case AmcEvents.AMC_EVENT_TEXT_TRACKS_CHANGED:
            // just update the player metrics to reflect the current selection
            uiMgr.updatePlayerMetrics({
                subtitleTracks: eventObj.value1 // available subtitle tracks and current subtitle track
            });
            break;

        /* This event is received when period switch reflect the current playback */
        case AmcEvents.AMC_EVENT_PERIOD_SWITCH:
            break;

        case AmcEvents.AMC_EVENT_PERIOD_SWITCHED:
            uiMgr.updateEventStreams({ isAdSkipped: true });
            uiMgr.toastMessage("Period Switched", 3000);
            break;

        case AmcEvents.AMC_EVENT_METRICS_UPDATE:
            let mediaPlayBackQualityMetrics = eventObj.value1;
            seekableRange = (mediaPlayBackQualityMetrics.video.seekableRange) ? mediaPlayBackQualityMetrics.video.seekableRange : null;
            // update the player metrics
            uiMgr.updatePlayerMetrics({
                videoPlaybackQualities: mediaPlayBackQualityMetrics.video,
                audioPlaybackQualities: mediaPlayBackQualityMetrics.audio,
            });
            break;

        case AmcEvents.AMC_EVENT_PLAYOUT_METRIC_UPDATE:
            let playoutMetricData = eventObj.value1;
            console.info(WMCRefApp_TAG, `amc event: ${AmcEvents.AMC_EVENT_PLAYOUT_METRIC_UPDATE}`);
            console.log(WMCRefApp_TAG, "Received playout metric: " + JSON.stringify(playoutMetricData));
            break;

        case AmcEvents.BEACON_FAIL_OPEN_STATUS:
            console.info(WMCRefApp_TAG, `amc event: ${AmcEvents.BEACON_FAIL_OPEN_STATUS}`);
            console.log(WMCRefApp_TAG, `beacon fail open mode ${eventObj.isInBeaconFailOpenMode ? 'active' : 'inactive'} ${eventObj.isProgramInfoAvailable ? 'with' : 'without'} program information`);
            uiMgr.toggleTimeShiftControlVisibility(eventObj.isInBeaconFailOpenMode || !eventObj.isProgramInfoAvailable, eventObj.isProgramInfoAvailable);
            blockControls();
            break;

        case AmcEvents.AMC_EVENT_PROGRAM_QUERY_STATUS:
            console.info(WMCRefApp_TAG, `amc event: ${AmcEvents.AMC_EVENT_PROGRAM_QUERY_STATUS}`);
            console.log(WMCRefApp_TAG, `program boundary crossover failed ${eventObj.isProgramInfoAvailable ? 'with' : 'without'} program information`);
            let programInfoAvailable = eventObj.isProgramInfoAvailable;
            uiMgr.toggleTimeShiftControlVisibility(!programInfoAvailable, programInfoAvailable);
            blockControls();
            if (!programInfoAvailable) {
                uiMgr.updateProgramTime("", "");
            }
            break;
        /* This event is received when complete some module upload*/
        case AmcEvents.AMC_EVENT_PROFILING:
            console.info(WMCRefApp_TAG, `WMC-Profiling: "${eventObj.value1.type}" duration ➸ ${eventObj.value1.time} ms`);
            switch (eventObj.value1.type) {
                case AmcConstants.IMC_PROFILING_INFO.backend.registration:
                case AmcConstants.IMC_PROFILING_INFO.backend.roll:
                case AmcConstants.IMC_PROFILING_INFO.backend.programQuery:
                    var t = Number(uiMgr._uiDOMElement.playerMetrics.backendModulesStartupTime.textContent) * 1000 + eventObj.value1.time;
                    // update the player metrics
                    uiMgr.updatePlayerMetrics({
                        backendModulesStartupTime: Number(t / 1000).toFixed(3)
                    });
                    break;
                case AmcConstants.IMC_PROFILING_INFO.playerLoad:
                    // update the player metrics
                    uiMgr.updatePlayerMetrics({
                        bitmovinLoadTime: Number(eventObj.value1.time / 1000).toFixed(3)
                    });
                    break;
                case AmcConstants.IMC_PROFILING_INFO.playerRender:
                    // update the player metrics
                    uiMgr.updatePlayerMetrics({
                        bitmovinRenderTime: Number(eventObj.value1.time / 1000).toFixed(3)
                    });
                    break;
            }
            break;
    }
}

/**
 * @summary
 * Handle the Chromecast session establishment
 *
 * @description
 * This event callback is recived when casting session is created
 * and playback needs to start on the cast receiver
 */
function onCastSessionEstablished() {
    if (wmcPlayer && castMgr) {
        let position = wmcPlayer.getVideoPosition() ? (wmcPlayer.getVideoPosition() * 1000) : 0;
        uiMgr.showSpinner(true);
        wmcPlayer.pause();
        castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.PlayClick, position); // bug 1306691: Sending starting position, but this will smoothly work for VOD only.
        uiMgr.showSpinner(false);
    }
}

/**
 * @summary
 * Handle the Chromecast session disconnect
 *
 * @description
 * This event callback is received when casting session is disconnected
 * and playback needs to start on the local player
 */
function onCastSessionDisconnect(e) {
    if (wmcPlayer && wmcPlayer.getVideoPosition() > 1) {
        wmcPlayer.resume();
        setTimeout(() => {
            if (castMgr && castMgr.getCurrentCastVideoPosition().videoPosition) {
                _seek(castMgr.getCurrentCastVideoPosition().videoPosition);
            }
        }, 100);
    }
    uiMgr.clearErrorMessage();
    uiMgr.resetControls();
}

function onPlaybackControlBlock(eventObj) {
    playBackControlRestrictions = (eventObj && eventObj.hasOwnProperty("controlRestrictions")) ? eventObj.controlRestrictions : [];
    if (!playBackControlRestrictions.length) {
        return;
    }
    blockControls();
}

function blockControls() {
    for (let i = 0; i < playBackControlRestrictions.length; i++) {
        var code = playBackControlRestrictions[i].code;
        const isDisabled = true;

        switch (code) {
            case 224: // Seek Forward
                uiMgr.disableEnablePlayerControls(PlayerControls.SkipForward, isDisabled);
                break;
            case 225: // Seek Back
                uiMgr.disableEnablePlayerControls(PlayerControls.SkipBack, isDisabled);
                break;
            case 228: // Pause
            case 229: // Resume
                uiMgr.disableEnablePlayerControls(PlayerControls.Pause, isDisabled);
                break;
            case 231: // Restart
                uiMgr.disableEnablePlayerControls(PlayerControls.Restart, isDisabled);
                break;
            case 233: // Seek Forward, Seek Back, Restart, Progress Bar
                uiMgr.disableEnablePlayerControls(PlayerControls.ProgressBar, isDisabled);
                uiMgr.disableEnablePlayerControls(PlayerControls.SkipForward, isDisabled);
                uiMgr.disableEnablePlayerControls(PlayerControls.SkipBack, isDisabled);
                uiMgr.disableEnablePlayerControls(PlayerControls.Restart, isDisabled);
                break;
        }
    }
}

/**
 * @summary
 * Handle the Chromecast player state update
 *
 * @description
 * This event callback is received when the state of the cast
 * receiver is changed i.e paused, resumed, seeked, etc
 */
function updateCastPlayerState(e) {
    let stateTo = null;
    if (e && typeof e.detail !== 'undefined') {
        switch (e.detail) {
            case 1:
                stateTo = "Playing"
                if (wmcPlayer) {
                    wmcPlayer.pause();
                    if (castMgr && castMgr.isCastSessionAlive()) {
                        let position = wmcPlayer.getVideoPosition() ? (wmcPlayer.getVideoPosition() * 1000) : 0;
                        uiMgr.showSpinner(false);
                        castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.SeekClick, position);
                    }
                }
                break;
            case 2:
                stateTo = "Paused"
                break;
            case 3:
                stateTo = "Resumed"
                break;
            case 5:
                stateTo = "Seeking"
                break;
            case 17:
                stateTo = "Idle";
                break;
            default:
                break;
        }
        if (stateTo) {
            updatePlayerState(stateTo)
        }
    }
}

/**
 * @summary
 * Register and listen for WMC Player events.
 */
function registerEventListeners() {
    // Note: WMC demands that these mandatory set of events be registered with it before
    // initializing the player. Without which initialization and/or playback will fail.
    // The mandatory events are:
    //   - AmcConstants.AMC_EVENT_INIT_COMPLETE        // Registered from createPlayer()
    //   - AmcConstants.AMC_EVENT_DEVICE_REGISTERED    // Registered from createPlayer()
    //   - AmcConstants.AMC_EVENT_PLAY_READY           // Registered from createPlayer()
    //   - AmcEvents.AMC_EVENT_ERROR                   // registered below
    //   - AmcEvents.AMC_EVENT_STATE_CHANGED           // registered below
    //   - AmcEvents.AMC_EVENT_PROGRAM_CHANGED         // registered below
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_PROGRAM_RESTRICTIONS, onPlaybackControlBlock);

    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_INIT_COMPLETE, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_DEVICE_REGISTERED, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_PLAY_READY, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_ERROR, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_STATE_CHANGED, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_PROGRAM_CHANGED, onPlayerEvent);
    // other optional events
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_SEEK_COMPLETE, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_VIDEO_POSITION_CHANGED, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_BIT_RATE_CHANGED, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_AD_STARTED, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_AD_QUARTILE, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_AD_FINISHED, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_AD_BREAK, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_PLAYER_METADATA, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_TEXT_TRACKS_CHANGED, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_TEXT_TRACKS_ADDED, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_AUDIO_TRACKS_CHANGED, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_PERIOD_SWITCH, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_PERIOD_SWITCHED, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_AD_MARKER_DATA, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_METRICS_UPDATE, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_PLAYOUT_METRIC_UPDATE, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.BEACON_FAIL_OPEN_STATUS, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_PROGRAM_QUERY_STATUS, onPlayerEvent);
    wmcPlayer.addEventListener(AmcEvents.AMC_EVENT_PROFILING, onPlayerEvent);
}

/**
 * @summary
 * Unregister and stop listening to WMC Player events.
 */
function unregisterEventListeners() {
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_PROGRAM_RESTRICTIONS, onPlaybackControlBlock);

    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_ERROR, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_STATE_CHANGED, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_PROGRAM_CHANGED, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_SEEK_COMPLETE, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_VIDEO_POSITION_CHANGED, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_BIT_RATE_CHANGED, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_AD_STARTED, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_AD_QUARTILE, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_AD_FINISHED, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_AD_BREAK, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_PLAYER_METADATA, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_TEXT_TRACKS_CHANGED, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_TEXT_TRACKS_ADDED, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_AUDIO_TRACKS_CHANGED, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_PERIOD_SWITCH, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_PERIOD_SWITCHED, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_AD_MARKER_DATA, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_METRICS_UPDATE, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_PLAYOUT_METRIC_UPDATE, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.BEACON_FAIL_OPEN_STATUS, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_PROGRAM_QUERY_STATUS, onPlayerEvent);
    wmcPlayer.removeEventListener(AmcEvents.AMC_EVENT_PROFILING, onPlayerEvent);
}

/**
 * @summary
 * Set the various player configuration parameters.
 *
 * @description
 * Called by createPlayer() to set the various player configuration
 * parameters for the new playback session. This function should be
 * called before calling AmcManager.init() so that the necessary
 * configuration parameters are applied and in place before initialization.
 *
 * @param {PlayerConfig} configParams the player configuration parameters
 */
function setPlayerConfigParams(configParams) {
    // Source
    if (configParams.hasOwnProperty("primaryAccount") && configParams.primaryAccount && !wmcPlayer.setPrimary(configParams.primaryAccount)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set primary account!");
    }
    if (configParams.hasOwnProperty("tenantId") && configParams.tenantId && !wmcPlayer.setTenantId(configParams.tenantId)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set tenant id!");
    }
    if (configParams.hasOwnProperty("catchupStartTime") && configParams.catchupStartTime && !wmcPlayer.setStartTime(configParams.catchupStartTime)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set catchup start time!");
    }
    if (configParams.hasOwnProperty("stsToken") && configParams.stsToken) {
        wmcPlayer.setSTSToken(configParams.stsToken);
    }
    // External Source
    if (configParams.hasOwnProperty("externalSourceUrl") && configParams.externalSourceUrl) {
        const externalSourceParams = {
            sourceUrl: configParams.externalSourceUrl,
            licenseUrl: configParams.hasOwnProperty("externalSourceLicenseUrl") && configParams.externalSourceLicenseUrl ? configParams.externalSourceLicenseUrl : null
        };
        isExternalSource = true;
        wmcPlayer.setExternalSourceParams(externalSourceParams);
    } else {
        isExternalSource = false;
    }
    // Features
    if (configParams.hasOwnProperty("lowLatencyEnabled") && configParams.lowLatencyEnabled) {
        wmcPlayer.setLowLatency(configParams.lowLatencyEnabled);
    }
    if (configParams.hasOwnProperty("bookmarkEnabled") && configParams.bookmarkEnabled) {
        wmcPlayer.setBookmarkEnabled(configParams.bookmarkEnabled);
    }
    if (configParams.hasOwnProperty("newServerEnabled") && configParams.newServerEnabled) {
        wmcPlayer.enableMKPApi(configParams.newServerEnabled);
    }
    if (configParams.hasOwnProperty("metricsEnabled") && configParams.metricsEnabled) {
        wmcPlayer.enableMetrics(configParams.metricsEnabled);
    }
    // Video Bitrate
    if (configParams.hasOwnProperty("maxVideoBitrate") && !wmcPlayer.setMaxBandwidth(parseInt(configParams.maxVideoBitrate, 10))) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set max video bitrate!");
    }
    if (configParams.hasOwnProperty("minVideoBitrate") && !wmcPlayer.setMinBandwidth(parseInt(configParams.minVideoBitrate, 10))) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set min video bitrate!");
    }
    if (configParams.hasOwnProperty("startingVideoBitrate") && !wmcPlayer.setStartBandwidth(parseInt(configParams.startingVideoBitrate, 10))) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set starting video bitrate!");
    }
    // InHome Server
    if (configParams.hasOwnProperty("inhomeServerUrl") && configParams.inhomeServerUrl) {
        configParams.inhomeServerEndpoint = decodeURIComponent(new URL(configParams.inhomeServerUrl).pathname);
        configParams.inhomeServerUrl = new URL(configParams.inhomeServerUrl).host;
        if (!wmcPlayer.setInHomeDetectionServiceURL(configParams.inhomeServerUrl, configParams.inhomeServerEndpoint)) {
            console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set the inhome server prameters!");
        }
    }
    if (configParams.hasOwnProperty("inhomeServerToken") && configParams.inhomeServerToken && !wmcPlayer.setInHomeToken(configParams.inhomeServerToken)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set the inhome server token!");
    }
    if (configParams.hasOwnProperty("defaultInhomeStatus") && configParams.defaultInhomeStatus && !wmcPlayer.setDefaultInHomeStatus(configParams.defaultInhomeStatus)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set default inhome server status!");
    }
    if (configParams.hasOwnProperty("forwardBuffer") || configParams.hasOwnProperty("backwardBuffer")) {
        var bufferData = {
            forwardDuration: (configParams.forwardBuffer !== ""
                && configParams.forwardBuffer !== undefined
                && configParams.forwardBuffer !== null) ? configParams.forwardBuffer : NaN,
            backwardDuration: (configParams.backwardBuffer !== ""
                && configParams.backwardBuffer !== undefined
                && configParams.backwardBuffer !== null) ? configParams.backwardBuffer : NaN
        }
        if (!wmcPlayer.setBufferLevel(bufferData)) {
            console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set the audio/video buffer!");
        }
    }

    // Other Settings
    if (configParams.hasOwnProperty("setOffset") && configParams.setOffset && !wmcPlayer.setOffset(configParams.setOffset, configParams.timelineReferencePoint)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set setOffset!");
    }
    if (configParams.hasOwnProperty("startupThreshold") && configParams.startupThreshold && !wmcPlayer.setStartupThreshold(configParams.startupThreshold)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set startup threshold!");
    }
    if (configParams.hasOwnProperty("restartThreshold") && configParams.restartThreshold && !wmcPlayer.setRestartThreshold(configParams.restartThreshold)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set restart threshold!");
    }
    if (configParams.hasOwnProperty("cdnToken") && configParams.cdnToken) {
        try {
            JSON.parse(configParams.cdnToken);
            if (!wmcPlayer.setCDNToken(JSON.parse(configParams.cdnToken))) {
                console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set cdn token!");
            }
        } catch (e) {
            console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set cdn token! value:", configParams.cdnToken);
        }
    }
    if (configParams.hasOwnProperty("cdnProfile") && configParams.cdnProfile && !wmcPlayer.setCdnProfile(configParams.cdnProfile)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set cdn profile!");
    }
    if (configParams.hasOwnProperty("cdnUrl") && configParams.cdnUrl && !wmcPlayer.setCdnUrl(configParams.cdnUrl)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set cdn url!");
    }
    if (configParams.hasOwnProperty("transcodeFormat") && configParams.transcodeFormat && !wmcPlayer.setTranscodeFormat(configParams.transcodeFormat)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set transcode format!");
    }
    if (configParams.hasOwnProperty("encDrmSeed") && configParams.encDrmSeed && !wmcPlayer.setEncSeed(configParams.encDrmSeed)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set enc drm seed!");
    }
    if (configParams.hasOwnProperty("manifestRetryCount") && configParams.manifestRetryCount && !wmcPlayer.setManifestRetryCount(configParams.manifestRetryCount)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set manifest retry count!");
    }
    if (configParams.hasOwnProperty("manifestRetryInterval") && configParams.manifestRetryInterval && !wmcPlayer.setManifestRetryInterval(configParams.manifestRetryInterval)) {
        console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Failed to set manifest retry interval!");
    }

    if (configParams.hasOwnProperty("beaconFailover") && configParams.beaconFailover) {
        let beaconFailover = configParams.beaconFailover;
        console.log(WMCRefApp_TAG, "beacon failover enabled set to: " + beaconFailover);
        let beaconFailoverDuration = (isNaN(configParams.beaconFailoverDuration) || configParams.beaconFailoverDuration < 0) ? 0 : configParams.beaconFailoverDuration;
        console.log(WMCRefApp_TAG, "beacon failover duration set to: " + beaconFailoverDuration);
        let beaconFailoverInitInterval = (isNaN(configParams.beaconFailoverInitInterval) || configParams.beaconFailoverInitInterval < 0) ? 0 : configParams.
            beaconFailoverInitInterval;
        console.log(WMCRefApp_TAG, "beacon failover init interval set to: " + beaconFailoverInitInterval);
        let beaconFailoverFinalInterval = (isNaN(configParams.beaconFailoverFinalInterval) || configParams.beaconFailoverFinalInterval < 0) ? 0 : configParams.beaconFailoverFinalInterval;
        console.log(WMCRefApp_TAG, "beacon failover final interval set to: " + beaconFailoverFinalInterval);
        if (!wmcPlayer.setBeaconFailOpenConfig(beaconFailover, beaconFailoverDuration, beaconFailoverInitInterval, beaconFailoverFinalInterval)) {
            console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Invalid AMC Parameter Beacon Failover!");
        }
    }

    if (configParams.hasOwnProperty("cdnFailoverPercentage") && configParams.cdnFailoverPercentage && !wmcPlayer.setCDNFailoverPercent(configParams.cdnFailoverPercentage)) {
        console.log(WMCRefApp_TAG, "setCDNFailoverPercent(): Failed to set CDN Failover Percentage");
    }

    if (configParams.hasOwnProperty("isDVR") && configParams.isDVR && !wmcPlayer.setDvrFromRollingBuffer(configParams.isDVR)) {
        console.log(WMCRefApp_TAG, "setDvrFromRollingBuffer(): Failed to set DVR");
    }

    // set the volume levels set in the UI to be applied on the player on start of playback
    const volumeSettings = uiMgr.getVolumeSettings();
    wmcPlayer.setStartupVolumeConfig(volumeSettings.volumeLevel, volumeSettings.muted);
    // setting the selected log level on start
    wmcPlayer.setLogLevel(uiMgr.getLogLevel());
}

/**
 * @summary
 * Create a new player to start a new playback session.
 *
 * @description
 * Creates a new player and sets it up with the given configuration
 * parameters and prepares it for the new playback session.
 *
 * @param {HTMLVideoElement} videoElement the video element defined in the HTML document
 * @param {HTMLDivElement} [subtitleContainer] the region/container where subtitles/captions will be rendered
 * @param {PlayerConfig} configParams the player configuration parameters
 *
 * @throws an exception with the error message in case of failure.
 */
function createPlayer(videoElement, subtitleContainer = null, configParams = {}) {
    // check if valid input parameters are given
    if (!videoElement && !Object.keys(configParams).length) {
        throw "Invalid parameters!";
    }

    // create a new wmc player (Note: primaryAccount can be passed as the value for userToken)
    wmcPlayer = new AmcManager(configParams.serverUrl, configParams.ownerUid, configParams.primaryAccount);
    if (!wmcPlayer) {
        throw "Failed to create new wmcPlayer!";
    }

    if (configParams.bitmovinPlayerKey) {
        wmcPlayer.setPlayerKey(configParams.bitmovinPlayerKey);
    }
    if (configParams.bitmovinAnalyticsKey) {
        wmcPlayer.setAnalyticsConfig(configParams.bitmovinAnalyticsKey);
        //wmcPlayer.setAnalyticsConfig(configParams.bitmovinAnalyticsKey, "userId", "videoId", "videoTitle", "experimentName", "cdnProvider", "customData1", "customData2");
    } else if (configParams.hasOwnProperty("analyticsEnabled") && configParams.analyticsEnabled) {
        wmcPlayer.setAnalyticsEnabled(configParams.analyticsEnabled);
    }

    //set player header
    uiMgr.updatePlayerHeaderText(HEADER_TEXT + '-' + wmcPlayer.getAmcVersion());

    // set the various configuration parameters
    setPlayerConfigParams(configParams);

    // register event listeners (should be called before calling init())
    registerEventListeners();

    // set the surface for video and subtitle container
    wmcPlayer.setContainer(videoElement, subtitleContainer);

    if (configParams.chromecastVersion === "v3") {
        wmcPlayer.enableChromecast(configParams.castReceiverAppId);
    }

    // initialize
    wmcPlayer.init();
}

/**
 * @summary
 * Play or Pause
 *
 * @description
 * Starts a new playback session or resume a paused playback. This is called when playPause
 * button is clicked.
 */
function onPlayPause() {
    if (castMgr && castMgr.isCastSessionAlive()) {
        if (wmcPlayerState === WMCRefAppPlayerState.Paused) {
            if (castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.ResumeClick)) {
                uiMgr.showSpinner(false);
                uiMgr.showPauseIcon();
            }
        } else if (wmcPlayerState === WMCRefAppPlayerState.Idle) { // cast again if session avalible.
            if (!Object.keys(wmcPlayerConfig).length) {
                wmcPlayerConfig = uiMgr.getConfigParams();
            }
            _startPlayBack();
        } else {
            if (castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.PauseClick)) {
                uiMgr.showSpinner(false);
                uiMgr.showPlayIcon();
            }
        }
        return;
    }

    if (wmcPlayer) {
        if (wmcPlayerState === WMCRefAppPlayerState.Idle) {
            console.log(WMCRefApp_TAG, "onPlayPause(): called in the wrong state!");
            return;
        } else if (wmcPlayerState === WMCRefAppPlayerState.Paused) {
            const currentPosition = wmcPlayer.getVideoPosition();
            if (isSeekableRange && !wmcPlayer.isInSeekableRange(currentPosition)) {
                uiMgr.toastMessage("Paused beyond seekable range! Resuming from Live");
                onLiveNow();
                return;
            }
            wmcPlayer.resume();
        } else {
            if (!isExternalSource && !wmcPlayer.isLiveEvent() && wmcPlayerConfig.playbackMode === "LIVE" && !wmcPlayer.timeshiftEnabled()) {
                uiMgr.toastMessage("Pause is not allowed in pure live mode!");
                return;
            }
            wmcPlayer.pause();
        }
    } else {
        try {
            uiMgr.clearErrorMessage(); // clear if any previous error messages exist
            wmcPlayerConfig = uiMgr.getConfigParams();
            const videoElement = uiMgr.getVideoElement();
            const subtitleContainer = uiMgr.getSubtitleContainer();
            // we need to reset the videoElement and clear the keys before we create the player
            if (videoElement) {
                videoElement.src = "";
                videoElement.setMediaKeys(null).then(() => {
                    loadTime = Date.now();
                    try {
                        createPlayer(videoElement, subtitleContainer, wmcPlayerConfig);
                    } catch (err) {
                        console.error(WMCRefApp_TAG, "createPlayer : ", err);
                    }
                }).catch((error) => {
                    throw "Failed to reset mediaKeys on videoElement!";
                });
            } else {
                throw "Missing video element!";
            }
        } catch (error) {
            uiMgr.showErrorMessage('', error);
            if (wmcPlayer) {
                wmcPlayer = null;
            }
        }
    }
}

/**
 * @summary
 * Restart the current program from beginning.
 *
 * @description
 * Attempt to restart the current program from beginning. This is called when the restart button
 * is clicked.
 */
function onRestart() {
    if (castMgr && castMgr.isCastSessionAlive()) {
        let seekPosition = wmcPlayerConfig.playbackMode === "LIVE" ? 1 : 0;
        _seek(seekPosition);
        return
    }
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        // for VoD, seek offset = 0, 1 for Live timeshift
        const seekPosition = (wmcPlayerConfig.playbackMode === "LIVE" && wmcPlayer.timeshiftEnabled() && !wmcPlayer.isLiveEvent()) ? 1 : 0;
        if (isSeekableRange && wmcPlayerConfig.playbackMode === "LIVE" && !wmcPlayer.isLiveEvent()) {
            if (!wmcPlayer.isInSeekableRange(seekPosition)) {
                uiMgr.toastMessage("Restart not allowed beyond seekable range!");
                return;
            }
        }
        _seek(seekPosition);
    }
}

/**
 * @summary
 * Skip backwards
 *
 * @description
 * Skip backwards WMCRefAppConstants.SkipBackSeconds in time if Skip backwards is allowed on the current
 * program. This is called when the skipBack button is clicked.
 */
function onSkipBack() {
    if (castMgr && castMgr.isCastSessionAlive()) {
        if (!isExternalSource && wmcPlayerConfig.playbackMode === "LIVE" && !timeshiftEnabled) {
            uiMgr.toastMessage("Seek/skip not allowed for pure live!");
            return;
        }
        let seekTo = (castMgr.getCurrentCastVideoPosition().videoPosition - WMCRefAppConstants.SkipBackSeconds) * 1000;
        seekTo = seekTo <= 1 ? 2 : seekTo;
        _seek(seekTo);
        return;
    }
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        if (!isExternalSource && !wmcPlayer.isLiveEvent() && wmcPlayerConfig.playbackMode === "LIVE" && !wmcPlayer.timeshiftEnabled()) {
            uiMgr.toastMessage("Seek/skip not allowed for pure live!");
            return;
        }
        const currentPosition = wmcPlayer.getVideoPosition();
        const duration = wmcPlayer.getVideoDuration();
        let seekTo = getActualTrickModeSeekTime(currentPosition, duration, WMCRefAppConstants.SkipBackSeconds);
        if (isSeekableRange && !wmcPlayer.isLiveEvent() && wmcPlayerConfig.playbackMode === "LIVE" && seekableRange) {
            if (!wmcPlayer.isInSeekableRange(seekTo)) {
                uiMgr.toastMessage("SkipBack not allowed beyond seekable range!");
                return;
            }
        }

        seekTo = seekTo <= 1 ? 2 : seekTo;
        _seek(seekTo);
    }
}

/**
 * @summary
 * Skip forward
 *
 * @description
 * Skip forward WMCRefAppConstants.SkipForwardSeconds in time if Skip forward is allowed on the current
 * program. This is called when the skipForward button is clicked.
 */
function onSkipForward() {
    if (castMgr && castMgr.isCastSessionAlive()) {
        let seekTo = Math.round((castMgr.getCurrentCastVideoPosition().videoPosition + WMCRefAppConstants.SkipForwardSeconds) * 1000);
        _seek(seekTo);
        return;
    }
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        if (!isExternalSource && !wmcPlayer.isLiveEvent() && wmcPlayerConfig.playbackMode === "LIVE" && !wmcPlayer.timeshiftEnabled()) {
            uiMgr.toastMessage("Seek/skip not allowed for pure live!");
            return;
        }
        const currentPosition = wmcPlayer.getVideoPosition();
        const programDuration = (wmcPlayerConfig.playbackMode === "LIVE" && wmcPlayer.timeshiftEnabled()) ?
            (wmcPlayer.getProgramInfo().duration / 1000) : wmcPlayer.getVideoDuration();

        let seekTo = getActualTrickModeSeekTime(currentPosition, programDuration, WMCRefAppConstants.SkipForwardSeconds);
        if (isSeekableRange && !wmcPlayer.isLiveEvent() && wmcPlayerConfig.playbackMode === "LIVE" && seekableRange) {
            if (!wmcPlayer.isInSeekableRange(seekTo)) {
                uiMgr.toastMessage("SkipForward not allowed beyond seekable range!");
                return;
            }
        }
        _seek(seekTo);
    }
}

/**
 * @summary
 * Skip Advertisement
 *
 * @description
 * Skip DAI Advertisement WMCRefAppConstants.SkipForwardSeconds in time if Skip forward is allowed on the current
 * program. This is called when the skipForward button is clicked.
 */
function onSkipAd() {
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle && uiMgr._markers) {
        if (wmcPlayerConfig.playbackMode === "LIVE" && !wmcPlayer.timeshiftEnabled()) {
            uiMgr.toastMessage("Seek/skip not allowed for pure live!");
            return;
        }
        if (adElapsedInterval) {
            clearInterval(adElapsedInterval);
        }
        let currentPosition = wmcPlayer.getVideoPosition();
        let seekTo = getActualSkipAdvertisementTime(currentPosition, adElapsedTime);

        _seek(Math.max(0, seekTo));
        uiMgr.updateEventStreams({ isAdSkipped: true });
        uiMgr.toastMessage("Seeked Advertisement");
    }
}

/**
 * @summary
 * Stop the current playback session.
 *
 * @description
 * Stops/ends the current playback session. This is called when the stop button is clicked.
 */
function onStop() {
    if (((castMgr && castMgr.isCastSessionAlive()) || wmcPlayer) && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        _stopPlayBack();
        uiMgr.toggleTimeShiftControlVisibility(false, true);
        uiMgr.updateEventStreams({ isAdSkipped: true });
    }
}

/**
 * @summary
 * Jump back to Live program.
 *
 * @description
 * When in timeshifted live mode, calling this function will take you
 * back to Live program and out of timeshift mode. This is called when
 * the liveNow button is clicked.
 */
function onLiveNow() {
    if (castMgr && castMgr.isCastSessionAlive()) {
        castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.LiveNowClick);
        // we will pull down the spinner and LiveNow button in 3.5 seconds for chromecast
        setTimeout(function () {
            uiMgr.showSpinner(false);
            uiMgr.showLiveNowButton(false);
            uiMgr.toastMessage("You are watching Live!");
        }, 3500);
        return;
    }
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        // no events are fired for liveNow and to avoid a brief blank screen, we will display a spinner.
        uiMgr.showSpinner(true);

        // jump to live now
        wmcPlayer.liveNow();

        // we will pull down the spinner and LiveNow button in 1.5 seconds
        // hoping that live playback will resume! We use this timeout to
        // make the vanishing of the button look cool :-)
        setTimeout(function () {
            uiMgr.showSpinner(false);
            uiMgr.showLiveNowButton(false);
            uiMgr.toastMessage("You are watching Live!");
        }, 1500);
    }
}

/**
 * @summary
 * Mute and unmute the volume.
 *
 * @description
 * Clicking the volume button will toggle the volume state
 * between mute and unmute
 *
 * @param {object} eventObj the eventObj containing mute or unmute value
 */
function onVolumeToggle(eventObj) {
    uiMgr.updateVolumeControls(eventObj.eventData.mute); // update the ui to show the correct volume icon
    if (castMgr && castMgr.isCastSessionAlive()) {
        castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.VolumeToggleClick, eventObj.eventData.mute);
        return;
    }
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        wmcPlayer.setMute(eventObj.eventData.mute);
    }
    // updating the ui nevertheless, on playback start this state will be applied
}

/**
 * @summary
 * Handle volume level change when the volume slider is updated.
 *
 * @description
 * Change and update the volume level based on the current position
 * of the volume slider
 *
 * @param {object} eventObj the eventObj containing the current volumeLevel selection
 */
function onVolumeChange(eventObj) {
    if (castMgr && castMgr.isCastSessionAlive()) {
        castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.VolumeSliderPositionChange, eventObj.eventData.volumeLevel);
        uiMgr.updateVolumeControls(); // update the ui to show the correct volume icon and progress fill
        return
    }
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        wmcPlayer.setMute(false);
        wmcPlayer.setVolume(eventObj.eventData.volumeLevel);
        uiMgr.updateVolumeControls(); // update the ui to show the correct volume icon and progress fill
    }
}

/**
 * @summary
 * Enable or disable closed captions.
 *
 * @description
 * This setting is part of the settings menu popup. When this toggle switch
 * is enabled, closed captions will be turned on if it is available in the stream.
 * Closed captions will be disabled when the toggle switch is turned off. If the
 * stream does not contain closed captions, turning this on and off will have no
 * effect.
 *
 * @param {object} eventObj the event object containing the toggle state (checked or unchecked) value
 */
function onCCToggle(eventObj) {
    const checked = eventObj.eventData.checked;
    // update the player metrics for the selected CC state.
    // even when the player is not ready and this was was selected,
    // upon playback start this value will be applied. So it's okay
    // to update the metrics here.
    uiMgr.updatePlayerMetrics({ closedCaptionsState: checked ? "Enabled" : "Disabled" });
    if (castMgr && castMgr.isCastSessionAlive()) {
        castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.CCToggle, checked);
        return;
    }
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        wmcPlayer.enableCC(checked);
    }
}

/**
 * @summary
 * Enable or disable subtitles.
 *
 * @description
 * This setting is part of the settings menu popup. Selecting a valid subtitle
 * track will enable the subtitles and when "off" is selected, the subtitle display
 * is disabled. If the stream does not contain any subtitle tracks, this setting
 * for selecting subtitles will not be present in the settings menu popup.
 *
 * @param {object} eventObj the event object containing the current subtitle track selection
 */
function onSubtitleTrackSelection(eventObj) {
    let subtitleTrack = eventObj.eventData.track;
    subtitleTrack = subtitleTrack === "off" ? null : subtitleTrack;
    if (castMgr && castMgr.isCastSessionAlive()) {
        castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.SubtitleTrackSelect, subtitleTrack)
        return;
    }

    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        let subtitleTrack = eventObj.eventData.track;
        subtitleTrack = subtitleTrack === "off" ? null : subtitleTrack;
        if (subtitleTrack) {
            wmcPlayer.setSubtitleState(true);
            wmcPlayer.setSubtitle(subtitleTrack);
        } else { // disable the text track
            wmcPlayer.disableTextTrack(subtitleTrack);
            // text track turned off/disabled - we update to reflect the same in player metrics
            uiMgr.updatePlayerMetrics({
                subtitleTracks: {
                    subtitleTracks: wmcPlayer.getSubtitles(),
                    currentSubtitleTrack: "off"
                }
            });
        }
    }
}

/**
 * @summary
 * Select an audio track.
 *
 * @description
 * This setting is part of the settings menu popup. This settings lists the available
 * audio tracks for the current program being played. If multiple audio tracks are listed
 * selecting an audio track here will change the current audio track being played. If
 * multiple audio tracks are not available then only the primary (single) audio track is listed.
 *
 * @param {object} eventObj the event object containing the current audio track selection
 */
function onAudioTrackSelection(eventObj) {
    let audioTrack = eventObj.eventData.track;
    if (audioTrack && castMgr && castMgr.isCastSessionAlive()) {
        castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.AudioTrackSelect, audioTrack)
        return;
    }
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        if (audioTrack) {
            wmcPlayer.setAudio(audioTrack);
        }
    }
}

/**
 * @summary
 * Increase or decrease the playback speed.
 *
 * @description
 * This setting is part of the settings menu popup. This setting allows the for increasing or
 * decreasing the playback speed during playback.
 *
 * @param {object} eventObj the event object containing the current playback speed selection
 */
function onPlaybackSpeedSelection(eventObj) {
    const playbackSpeed = eventObj.eventData.speed;
    if (playbackSpeed && castMgr && castMgr.isCastSessionAlive()) {
        castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.PlaybackSpeedSelect, playbackSpeed)
        return;
    }
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        wmcPlayer.setPlaySpeed(playbackSpeed);
    }
    // update the player metrics for the selected playback speed.
    // even when the player is not ready and this was was selected,
    // upon playback start this value will be applied. So it's okay
    // to update the metrics here.
    uiMgr.updatePlayerMetrics({ playbackSpeed: playbackSpeed });
}

/**
 * @summary
 * Change the log level of the player
 *
 * @description
 * This setting is part of the settings menu popup. This setting allows the for setting a log
 * level for the player logs. Only available during a playback session.
 *
 * @param {object} eventObj the event object containing the current log level selection
 */
function onLogLevelSelection(eventObj) {
    if (castMgr && castMgr.isCastSessionAlive()) {
        castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.LogLevelSelect, parseInt(eventObj.eventData.logLevel, 10));
        return;
    }
    if (wmcPlayer) {
        wmcPlayer.setLogLevel(parseInt(eventObj.eventData.logLevel, 10));
    }
}

/**
 * @summary
 * Handle the change of video position due to change in the video slider.
 *
 * @description
 * When the video slider knob is moved, attempt to seek video to the new position
 * offset.
 *
 * @param {object} eventObj the event object containing the current position of the knob on video slider
 */
function onVideoSliderPositionChange(eventObj) {
    console.log(WMCRefApp_TAG, "onVideoSliderPositionChange : ", (eventObj && eventObj.eventData && eventObj.eventData.position) ? eventObj.eventData.position : "N/A");
    if (castMgr && castMgr.isCastSessionAlive()) {
        if (!isExternalSource && wmcPlayerConfig.playbackMode === "LIVE" && !timeshiftEnabled) {
            uiMgr.toastMessage("Seek/skip not allowed for pure live!");
            return;
        }
        let seekTo = (getActualSeekTime(castMgr.getCurrentCastVideoPosition().videoDuration, Number(eventObj.eventData.position)) * 1000);
        _seek(seekTo);
        return
    }
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        let programDuration = wmcPlayer.getVideoDuration(); // for VoD and non-timeshift
        if (!isExternalSource && !wmcPlayer.isLiveEvent() && wmcPlayerConfig.playbackMode === "LIVE") {
            if (wmcPlayer.timeshiftEnabled()) {
                programDuration = wmcPlayer.getProgramInfo().duration / 1000;
            } else {
                uiMgr.toastMessage("Seek/skip not allowed for pure live!");
                return;
            }
        }
        let seekToPosition = getActualSeekTime(programDuration, Number(eventObj.eventData.position));
        if (isSeekableRange && wmcPlayerConfig.playbackMode === "LIVE" && seekableRange) {
            if (!wmcPlayer.isInSeekableRange(seekToPosition)) {
                uiMgr.toastMessage("Seek/skip not allowed beyond seekable range!");
                return;
            }
        }
        _seek(seekToPosition);
    } else {
        uiMgr.updateVideoSliderPosition(0);
    }
}

/**
 * @summary
 * Handle the change of progress color due to user input.
 *
 * @description
 * When the video slider knob is moved, attempt to seek video to the new position
 * offset while player is already initialized.
 *
 */
function onVideoSliderInputChange() {
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        uiMgr.updateVideoSliderColor(true);
    }
}

/**
 * @summary
 * Handle the selection of a source list item in the UI
 *
 * @description
 * This event callback is received when any source list item
 * in the WMCRefAppUIManager is selected. When this event is received
 * the UI config parameters for the new source are updated, so
 * in order to play the selected source, we need to query the
 * latest set of configParams by calling uiMgr.getConfigParams
 * and initiate a new playback session.
 */
function onSourceListItemSelected() {
    // end the current playback session and start a new one.
    if (wmcPlayer || (castMgr && castMgr.isCastSessionAlive())) {
        // setting playNext to true will trigger creation of a new playback session once the existing session is cleaned up
        playNext = true;
        _stopPlayBack();
    } else {
        // start a new session - just call onPlayPause() and it will do it for us.
        onPlayPause();
    }
}

/**
 * @summary
 * Handle click of the Get InHome Status button.
 *
 * @param {object} eventObj the event data object containing the defaultInHomeStatus
 * and setInhomeStatus value from the config forms in the UI.
 */
function onGetInhomeStatus(eventObj) {
    if (wmcPlayer) {
        if (configPrams.inhomeServerUrl && configPrams.inhomeServerToken) {
            wmcPlayer.getInHomeStatus()
                .then((status) => {
                    uiMgr.toastMessage(`Get InHome Status: ${JSON.stringify(status)}`);
                    console.log(WMCRefApp_TAG, `Get InHome Status: ${JSON.stringify(status, null, 4)}`);
                }).catch((err) => {
                    uiMgr.toastMessage(`Get InHome Status: ${JSON.stringify(err)}`);
                    console.log(WMCRefApp_TAG, `Error getting InHome Status: ${JSON.stringify(err, null, 4)}`);
                });
        } else {
            uiMgr.showConsoleInfo({
                message: !configPrams.inhomeServerUrl ? "Invalid InHome Server Url" : "Invalid InHome Server Token",
                type: 'warn'
            });
        }
    }
}

/**
 * @summary
 * Handle click of the Set InHome Status button.
 *
 * @param {object} eventObj the event data object containing the defaultInHomeStatus
 * and setInhomeStatus value from the config forms in the UI.
 */
function onSetInhomeStatus(eventObj) {
    if (wmcPlayer && !wmcPlayer.getDefaultInHomeStatus()) {
        wmcPlayer.setDefaultInHomeStatus(eventObj.eventData.defaultInhomeStatusValue);
    }
    uiMgr.toastMessage(`Set InHome Status: ${eventObj.eventData.setInhomeStatusValue}`);
    wmcPlayer.setInHomeStatus(eventObj.eventData.setInhomeStatusValue);
}

/**
 * @summary
 * Get Skip Advertisement time
 *
 * @description
 * return skip advertisement time, only for DAI asset
 *
 * @param {number} pos acutal media position, including DA interval
 * @param {number} dur actual media duration, including DA interval
 *
 * @returns {number} returns advertisement end time
 */
function getActualSkipAdvertisementTime(pos, delta = 0) {
    pos = uiMgr.fixedTo(pos, 2);
    let markers = uiMgr._markers;
    let seekTo = 0;

    if (markers && markers.actualDAStartTimeList) {
        for (let i = 0; i < markers.actualDAStartTimeList.length; i++) { // Advt. Interval (Pi, Di)
            if (wmcPlayerConfig.playbackMode === "LIVE") {
                seekTo = pos + markers.admarkersIntervalList[i];
                break;
            }
            if (pos >= markers.actualDAStartTimeList[i] && pos <= (markers.actualDAStartTimeList[i] + markers.admarkersIntervalList[i])) {
                seekTo = markers.actualDAStartTimeList[i] + markers.admarkersIntervalList[i];
                break;
            }
        }
    }

    seekTo -= delta;

    return seekTo;
}

/**
 * @summary
 * Get video position after seeking
 *
 * @description
 * return actual seektime including DA interval
 * after change the seekbar position in RefApp
 *
 * @param {number} dur actual media duration; including DA interval
 * @param {number} seekPercentage media seekBar percentage/position
 *
 * @returns {number} returns actual seekTime including DA interval
 */
function getActualSeekTime(dur, seekPercentage) {
    let markers = uiMgr._markers;
    dur = dur - (markers && markers.totalDADuration ? markers.totalDADuration : 0); // without DA duration
    let seekTo = uiMgr.fixedTo((seekPercentage / 100) * dur, 2);

    if (markers && markers.adMarkerSeekbarList) {
        for (let i = 0; i < markers.adMarkerSeekbarList.length; i++) {
            if (seekPercentage > markers.adMarkerSeekbarList[i]) {
                seekTo += markers.admarkersIntervalList[i];
            }
        }
    }
    return seekTo;
}

/**
 * @summary
 * Get video position after forward/backward asset
 *
 * @description
 * return actual asset position / advertisement star time
 * after click forward/backward button
 *
 * @param {number} pos actual position of asset
 * @param {number} dur actual duration of asset
 * @param {number} seekDelta seekDelta position
 *
 * @returns {number} return actual asset position / advertisement start time including DA interval
 */
function getActualTrickModeSeekTime(pos, dur, seekDelta) {
    let markers = uiMgr._markers;
    seekDelta = seekDelta === WMCRefAppConstants.SkipForwardSeconds ? seekDelta : (0 - seekDelta);
    let seekTo = uiMgr.fixedTo(seekDelta > 0 ? Math.min(pos + seekDelta, dur) : Math.max(0, pos + seekDelta), 2);

    if (markers && markers.actualDAStartTimeList) {
        for (let i = 0; i < markers.actualDAStartTimeList.length; i++) { // Advt. Interval (Pi, Di)
            if (seekDelta > 0) { // pos <= Pi <= SeekTo :: Pi = advt_start_time
                if ((pos <= markers.actualDAStartTimeList[i]) && (markers.actualDAStartTimeList[i] <= seekTo)) {
                    seekTo = markers.actualDAStartTimeList[i];
                    break;
                }
            } else { // SeekTo <= Di <= pos :: Di = advt_end_time (Pi + advt_dur)
                if ((seekTo <= (markers.actualDAStartTimeList[i] + markers.admarkersIntervalList[i])) && ((markers.actualDAStartTimeList[i] + markers.admarkersIntervalList[i]) <= pos)) {
                    seekTo = markers.actualDAStartTimeList[i];
                    break;
                }
            }
        }
    }
    return seekTo;
}

/**
 * @summary
 * Set the beacon config
 *
 * @description
 * Set the beacon config during playback
 * if change initiated from RefApp
 *
 * @param {event} e event data
 */
function onBeaconDataChange(e) {
    if (wmcPlayer) {
        let configParams = e.eventData;
        let beaconFailover = configParams.beaconFailover;
        console.log(WMCRefApp_TAG, "beacon failover enabled set to: " + beaconFailover);
        let beaconFailoverDuration = (isNaN(configParams.beaconFailoverDuration) || configParams.beaconFailoverDuration < 0) ? 0 : parseInt(configParams.beaconFailoverDuration);
        console.log(WMCRefApp_TAG, "beacon failover duration set to: " + beaconFailoverDuration);
        let beaconFailoverInitInterval = (isNaN(configParams.beaconFailoverInitInterval) || configParams.beaconFailoverInitInterval < 0) ? 0 : parseInt(configParams.beaconFailoverInitInterval);
        console.log(WMCRefApp_TAG, "beacon failover init interval set to: " + beaconFailoverInitInterval);
        let beaconFailoverFinalInterval = (isNaN(configParams.beaconFailoverFinalInterval) || configParams.beaconFailoverFinalInterval < 0) ? 0 : parseInt(configParams.beaconFailoverFinalInterval);
        console.log(WMCRefApp_TAG, "beacon failover final interval set to: " + beaconFailoverFinalInterval);
        if (!wmcPlayer.setBeaconFailOpenConfig(beaconFailover, beaconFailoverDuration, beaconFailoverInitInterval, beaconFailoverFinalInterval)) {
            console.log(WMCRefApp_TAG, "setPlayerConfigParams(): Invalid AMC Parameter Beacon Failover!");
        }
    }
}

/**
 * @summary
 * Change the playback quality.
 *
 * @description
 * This setting is part of the settings menu popup. This setting allows to change the
 * playback quality.
 *
 * @param {object} eventObj the event object containing the current playback quality selection
 */
function onPlaybackQualitySelection(eventObj) {
    const playbackQualityId = eventObj.eventData.qualityId;
    if (playbackQualityId && castMgr && castMgr.isCastSessionAlive()) {
        castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.PlaybackQualitySelect, playbackQualityId)
        return;
    }
    if (wmcPlayer && wmcPlayerState !== WMCRefAppPlayerState.Idle) {
        wmcPlayer.setVideoQuality(playbackQualityId);
    }
}

/**
 * @summary
 * Helper method for start playback
 *
 * @description
 * This method is a helper method for starting playback
 * based with condition check for casting
 */
function _startPlayBack() {
    if (castMgr && castMgr.isCastSessionAlive()) {
        if (castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.PlayClick)) {
            uiMgr.showSpinner(false);
            uiMgr.showPauseIcon();
        }
    } else {
        wmcPlayer.start();
    }
}

/**
* @summary
* Helper method for stop playback
*
* @description
* This method is a helper method for stopping playback
* based with condition check for casting
*/
function _stopPlayBack() {
    if (castMgr && castMgr.isCastSessionAlive()) {
        if (castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.StopClick)) {
            uiMgr.showSpinner(false);
            uiMgr.showPlayIcon();
        }
        if (playNext) {
            playNext = false;
            onPlayPause();
        } else {
            if (wmcPlayer) {
                wmcPlayer.stop();
            }
        }
    } else if (wmcPlayer) {
        wmcPlayer.stop();
    }
}

/**
* @summary
* Helper method for seek playback
*
* @description
* This method is a helper method for seeking playback
* based with condition check for casting
*
* @param {number} time isCastingAvaliable then milliseconds, otherwise seconds
*/
function _seek(time) {
    if (castMgr && castMgr.isCastSessionAlive()) {
        uiMgr.showSpinner(true);
        if ((castMgr.getCastSessionState() === "SESSION_ENDING") ||
            (castMgr.getCastSessionState() === "SESSION_ENDED")) {
            wmcPlayer.seek(time);
            uiMgr.showSpinner(false);
            return;
        }
        if (castMgr.castSenderPlayerEvent(WMCChromeCastSenderEvent.SeekClick, time)) {
            uiMgr.showSpinner(false);
        }
    } else {
        wmcPlayer.seek(time);
    }
}

/**
 * @summary
 * Initialize the WMCRefApp
 *
 * @description
 * Initialize the WMCRefAppUIManager and register event listeners for WMCRefAppUIManager
 * button clicks.
 */
function initializeWMCRefApp() {
    // get hold of the ui manager
    uiMgr = (typeof wmcUIMgr !== 'undefined') ? wmcUIMgr : new WMCRefAppUIManager();
    if (!uiMgr) {
        throw "[WMCRefApp] Failed to get hold of WMCRefAppUIManager";
    }

    // dispatch event for WMCRefAppLoaded
    document.dispatchEvent(new CustomEvent("WMCRefAppLoaded"));

    /* handle to the chrome cast manager */
    castMgr = ((typeof wmcUIMgr !== 'undefined') && uiMgr._uiDOMElement.player.googleCastButton.length) ? new CastSenderManager() : null;

    // register event listeners for player controls (button clicks)
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.PlayPauseClick, onPlayPause);           // everything starts with the click of the playPause button
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.RestartClick, onRestart);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.SkipBackClick, onSkipBack);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.StopClick, onStop);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.SkipForwardClick, onSkipForward);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.LiveNowClick, onLiveNow);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.VolumeToggleClick, onVolumeToggle);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.VolumeSliderPositionChange, onVolumeChange);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.CCToggle, onCCToggle);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.SubtitleTrackSelect, onSubtitleTrackSelection);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.AudioTrackSelect, onAudioTrackSelection);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.PlaybackSpeedSelect, onPlaybackSpeedSelection);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.PlaybackQualitySelect, onPlaybackQualitySelection);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.LogLevelSelect, onLogLevelSelection);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.VideoSliderPositionChange, onVideoSliderPositionChange);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.VideoSliderInputChange, onVideoSliderInputChange);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.SourceListItemSelected, onSourceListItemSelected);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.GetInhomeServerStatusButtonClick, onGetInhomeStatus);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.SetInhomeServerStatusButtonClick, onSetInhomeStatus);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.SkipAdvertisementButtonClick, onSkipAd);
    uiMgr.addEventListener(WMCRefAppUIManagerEvent.BeaconDataChange, onBeaconDataChange);

    document.addEventListener("updateCastPlayerState", updateCastPlayerState);
    document.addEventListener("onCastSessionEstablished", onCastSessionEstablished);
    document.addEventListener("onCastSessionDisconnect", onCastSessionDisconnect);
}

/*
 * Wait for the UI Elements to load
 */
window.onload = function onload() {
    // Initialize the WMCRefApp -- this should kick start everything to life.
    initializeWMCRefApp();
};


"use strict";

/**
 * @summary
 * WMCRefAppUIManager Events
 *
 * @description
 * Events that will be triggered when the UI Elements change state.
 *
 * @readonly
 * @enum {string}
 */
const WMCRefAppUIManagerEvent = {
    /** @member {string} */
    /** This event is triggered when the position of the knob on the video progress bar is changed (due to user input) */
    VideoSliderPositionChange: "onVideoSliderPositionChange",
    /** This event is triggered when the knob is dragged or clicked by the user */
    VideoSliderInputChange: "onVideoSliderInputChange",
    /** @member {string} */
    /** This event is triggered on click of the restart button */
    RestartClick: "onRestartButtonClick",
    /** @member {string} */
    /** This event is triggered on click of the skipBack button */
    SkipBackClick: "onSkipBackButtonClick",
    /** @member {string} */
    /** This event is triggered on click of the playPause button */
    PlayPauseClick: "onPlayPauseButtonClick",
    /** @member {string} */
    /** This event is triggered on click of the stop button */
    StopClick: "onStopButtonClick",
    /** @member {string} */
    /** This event is triggered on click of the skipForward button */
    SkipForwardClick: "onSkipForwardButtonClick",
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
    /** This event is triggered when the log level is selected */
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
    /** This event is triggered when skip advertisement/period in multi period stream */
    SkipAdvertisementButtonClick: "onSkipAdButtonClick",
    /** @member {string} */
    /** This event is triggered when beacon failover is toggled or data is changed */
    BeaconDataChange: "onBeaconDataChange",
    /** @member {string} */
    /** This event is triggered when the playback quality is selected */
    PlaybackQualitySelect: "onPlaybackQualitySelect"

};
Object.freeze(WMCRefAppUIManagerEvent);

const DEFAULT_RECEIVER_APPID = '88E92036';

/*
 * Font Awesome Icon Class Names
 */
const FAIconClassName = {
    Restart: "fas fa-redo",
    SkipBack: "fas fa-backward",
    Play: "fas fa-play",
    Pause: "fas fa-pause",
    Stop: "fas fa-stop",
    SkipForward: "fas fa-forward",
    VolumeUp: "fas fa-volume-up",
    VolumeDown: "fas fa-volume-down",
    VolumeMute: "fas fa-volume-mute",
    Settings: "fas fa-cog",
    SettingsSpin: "fas fa-cog fa-spin",
    Expand: "fas fa-expand",
    Compress: "fas fa-compress",
    Spinner: "fas fa-circle-notch fa-spin"
};
Object.freeze(FAIconClassName);

/*
 * Player control map
 */
const PlayerControls = {
    Restart: "restart",
    SkipBack: "skip-backward",
    Play: "play",
    Pause: "pause",
    Stop: "stop",
    SkipForward: "skip-forward",
    Volume: "volume",
    ProgressBar: "video-slider",
    ShowAds: "show-ads",
    SkipAds: "skip-ads",
    LiveNow: "live-now"
};
Object.freeze(PlayerControls);

const WMCRefAppUIManager_TAG = "[WMCRefAppUIManager]";
var isAdSkipped = true;

/*
 * Config saver module.
 *
 * Saves, restores the configuration parameters entered in the forms in the URL hash
 * on load/refresh of the page.
 */
let configSaver = (function () {
    let currentConfig = {};

    function restoreConfig() {
        Object.keys(currentConfig).forEach(key => {
            if (key !== "load-source-config-file-path") {
                let field = document.getElementById(key);
                if (field) {
                    let type = field.type;
                    if (type === "checkbox" || type === "radio") {
                        field.checked = currentConfig[key] === "true";
                    } else {
                        field.value = currentConfig[key];
                    }
                }
            }
        });
    }

    function getConfigFromHash() {
        let config = {};
        let keyValues = window.location.hash.substring(1).split("&");
        for (let i = 0; i < keyValues.length; i++) {
            let keyValue = keyValues[i].split("=");
            if (keyValue[1]) {
                config[keyValue[0]] = decodeURIComponent(keyValue[1]);
            }
        }
        currentConfig = config;
    }

    function saveConfigToHash() {
        let keyValues = [];
        Object.keys(currentConfig).forEach(key => {
            keyValues.push(key + "=" + encodeURIComponent(currentConfig[key]));
        });
        window.location.hash = keyValues.join("&");
    }

    function refreshCurrentConfig() {
        const elements = document.getElementsByClassName("save-config");
        for (let i = 0; i < elements.length; i++) {
            const id = elements[i].id;
            const value = elements[i].value;
            const type = elements[i].type;
            if (type === "checkbox" || type === "radio") {
                currentConfig[id] = elements[i].checked;
            }
            else if (value) {
                currentConfig[id] = value;
            }
            else if (value === "") {
                delete currentConfig[id];
            }
        }
        saveConfigToHash();
    }

    function saveOnChange(e) {
        if (e.target.type === "checkbox" || e.target.type === "radio") {
            currentConfig[e.target.id] = e.target.checked;
        }
        else if (e.target.value) {
            currentConfig[e.target.id] = e.target.value;
        } else {
            delete currentConfig[e.target.id];
        }
        refreshCurrentConfig();
    }

    function addChangeListeners() {
        let elements = document.getElementsByClassName("save-config");
        for (let i = 0; i < elements.length; i++) {
            elements[i].addEventListener("change", saveOnChange);
        }
    }

    getConfigFromHash();

    return {
        restoreConfig: restoreConfig,
        addChangeListeners: addChangeListeners,
        refreshCurrentConfig: refreshCurrentConfig
    };
})();

/**
 * @class
 * WMCRefAppUIManager
 *
 * @summary
 * WMC RefApp's UI manager.
 *
 * @description
 * Everything in the WMC RefApp UI is controlled and managed by this class.
 *
 * @example
 * function initializeWMCRefApp () {
 *   // get hold of the ui manager
 *   uiMgr = new WMCRefAppUIManager();
 *   if (!uiMgr) {
 *       throw "[WMCRefApp] Failed to get hold of WMCRefAppUIManager";
 *   }
 *
 *   // register event listeners for player controls (button clicks)
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.PlayPauseClick, onPlayPause);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.RestartClick, onRestart);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.SkipBackClick, onSkipBack);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.StopClick, onStop);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.SkipForwardClick, onSkipForward);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.LiveNowClick, onLiveNow);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.VolumeToggleClick, onVolumeToggle);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.VolumeSliderPositionChange, onVolumeChange);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.CCToggle, onCCToggle);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.SubtitleTrackSelect, onSubtitleTrackSelection);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.AudioTrackSelect, onAudioTrackSelection);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.PlaybackSpeedSelect, onPlaybackSpeedSelection);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.LogLevelSelect, onLogLevelSelection);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.VideoSliderPositionChange, onVideoSliderPositionChange);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.SourceListItemSelected, onSourceListItemSelected);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.GetInhomeServerStatusButtonClick, onGetInhomeStatus);
 *   uiMgr.addEventListener(WMCRefAppUIManagerEvent.SetInhomeServerStatusButtonClick, onSetInhomeStatus);
 * }
 *
 * // For more details, look at the detailed usage in WMCRefApp.js
 */
class WMCRefAppUIManager {
    /**
     * @summary
     * Register to listen for a given event type.
     *
     * @description
     * Add a event listener to get notified when the said event occurs.
     *
     * @param {WMCRefAppUIManagerEvent} eventType the event type
     * @param {Function} listener the event listener
     */
    addEventListener(eventType, listener) {
        if (!eventType || typeof listener !== "function") {
            console.log(WMCRefAppUIManager_TAG, "addEventListener: Invalid parameters!");
            return;
        }
        this._eventListeners.push({ eventType, listener });
    }

    /**
     * @summary
     * Clear and remove the content poster image from display.
     */
    clearContentPoster() {
        this._uiDOMElement.player.posterImage.src = "";
        this._uiDOMElement.player.contentPoster.style.display = "none";
    }

    /**
     * @summary
     * Clear the error message.
     *
     * @description
     * Clears the error message and hides it from display.
     */
    clearErrorMessage() {
        this._uiDOMElement.player.errorCode.textContent = "";
        this._uiDOMElement.player.errorMessage.textContent = "";
        this._uiDOMElement.player.errorMessageContainer.style.display = "none";
    }

    /**
     * @summary
     * Exit from fullscreen mode and back to normal viewing mode.
     *
     * @description
     * Exit fullscreen mode. This function will only work if you are in fullscreen mode.
     * It will have no effect otherwise.
     */
    exitFullscreen() {
        if (this._uiDOMElement.player.fullscreenButton.className.includes(FAIconClassName.Compress)) {
            this._uiDOMElement.player.fullscreenButton.click(); // soft click to exit fullscreen
            this.showConsoleInfo({ message: 'exit fullscreen mode' });
        }
    }

    /**
     * @summary
     * Update player header with version and player details
     *
     * @description
     * Update player header with version and player details
     */
    updatePlayerHeaderText(msg) {
        this._uiDOMElement.player.playerHeaderContainer.innerHTML = msg;
    }

    /**
     * @summary
     * Get the audio element.
     *
     * @returns {HTMLAudioElement} returns the audio element of the player
     */
    getAudioElement() {
        return this._uiDOMElement.player.audioElement;
    }

    /**
     * @summary
     * Get the current state of the CC Toggle Switch.
     *
     * @returns {boolean} true when the CC Toggle Switch is enabled, false otherwise
     */
    getClosedCaptionsState() {
        return this._uiDOMElement.player.ccToggle.checked;
    }

    /**
     * @summary
     * Get the player configuration parameters.
     *
     * @description
     * Get the player configuration parameters entered in the config forms.
     *
     * @returns {PlayerConfig} the object containing player configuration parameters is returned
     */
    getConfigParams() {
        let configParams = {};
        Object.keys(this._uiDOMElement.config).forEach(key => {
            if (this._uiDOMElement.config[key]) {
                if (this._uiDOMElement.config[key].type === "checkbox") {
                    configParams[key] = this._uiDOMElement.config[key].checked;
                } else if (this._uiDOMElement.config[key].type === "text") {
                    configParams[key] = this._uiDOMElement.config[key].value.trim();
                } else if (this._uiDOMElement.config[key].type === "number") {
                    configParams[key] = parseInt(this._uiDOMElement.config[key].value, 10);
                } else {
                    if (this._uiDOMElement.config[key].type !== "button") {
                        configParams[key] = this._uiDOMElement.config[key].value;
                    }
                }
            } else {
                configParams[key] = "";
            }
        });
        return configParams;
    }

    /**
     * @summary
     * Convert the given value in seconds to HH:MM:SS format time string.
     *
     * @description
     * Utility function to convert the given value (time in seconds) to
     * a date string in HH:MM:SS format.
     *
     * @param {string} valueInSeconds the value in seconds to convert
     * @returns {string} HH:MM:SS time format string will be returned
     */
    getHHMMSS(valueInSeconds) {
        valueInSeconds = valueInSeconds ? parseInt(valueInSeconds, 10) : 0;

        let date = new Date(valueInSeconds * 1000);
        let hours = date.getUTCHours();
        let minutes = date.getUTCMinutes();
        let seconds = date.getUTCSeconds();

        hours = hours < 10 ? ("0" + hours) : hours;
        minutes = minutes < 10 ? ("0" + minutes) : minutes;
        seconds = seconds < 10 ? ("0" + seconds) : seconds;

        date = null;
        return hours + ":" + minutes + ":" + seconds;
    }

    /**
     * @summary
     * Get the current selected log level value.
     *
     * @returns {string} the current selected log level value
     */
    getLogLevel() {
        return this._uiDOMElement.player.logLevelSelect.value;
    }

    /**
     * @summary
     * Get the current selected playback speed value.
     *
     * @returns {string} the current selected playback speed value
     */
    getPlaybackSpeed() {
        return this._uiDOMElement.player.playbackSpeedSelect.value;
    }

    /**
     * @summary
     * Get the player container.
     *
     * @returns {HTMLDivElement} returns the main player container
     */
    getPlayerContainer() {
        return this._uiDOMElement.player.playerContainer;
    }

    /**
     * @summary
     * Get the subtitle container.
     *
     * @returns {HTMLDivElement} returns the subtitle container of the player
     */
    getSubtitleContainer() {
        return this._uiDOMElement.player.subtitleContainer;
    }

    /**
     * @summary
     * Get the player header text.
     *
     * @returns {HTMLVideoElement} returns the header element of the player
     */
    getPlayerHeader() {
        return this._uiDOMElement.player.playerHeaderContainer;
    }

    /**
     * @summary
     * Get the video element.
     *
     * @returns {HTMLVideoElement} returns the video element of the player
     */
    getVideoElement() {
        return this._uiDOMElement.player.videoElement;
    }

    /**
     * @summary
     * Get the current volume settings
     *
     * @returns {object} an object containing the current volume slider position value
     * and the mute state.
     */
    getVolumeSettings() {
        return {
            muted: this._uiDOMElement.player.volumeButton.className === FAIconClassName.VolumeMute ? true : false,
            volumeLevel: this._uiDOMElement.player.volumeSlider.value
        };
    }

    /**
     * @summary
     * Hide or dismiss the settings menu popup.
     */
    hideSettingsMenu() {
        this._uiDOMElement.player.settingsMenu.style.transform = "translateX(110%)";
        this._uiDOMElement.player.settingsButton.className = `video-control ${FAIconClassName.Settings}`;
    }

    /**
     * @summary
     * Check if the liveNow buttons is visible or hidden.
     *
     * @returns {boolean} true when visible, false otherwise
     */
    isLiveNowButtonVisible() {
        return this._uiDOMElement.player.liveNowButton.style.display === "block" ? true : false;
    }

    /**
     * @summary
     * Load a config (JSON) file.
     *
     * @description
     * Utility function to load a config file containing JSON data and get notified
     * via a callback with the data as a JSON object.
     *
     * @param {File} file the path or url to the location of the file to be loaded
     * @param {Function} callback the callback function on which the caller will be
     * notified when the file is completely loaded and along will this callback the
     * loaded data will be returned.
     */
    loadConfigFile(file, callback) {
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                let jsonObj = JSON.parse(xhr.responseText);
                if (callback && typeof callback === "function" && Object.keys(jsonObj).length) {
                    callback(jsonObj);
                }
            }
        }
        xhr.onloadend = function () {
            if (xhr.status == 404) {
                callback(false);
            }
        }
        xhr.open("GET", file, true);
        xhr.send();
    }

    /**
     * @summary
     * Event handler for the change event for the audio track selection.
     *
     * @description
     * This event handler is called when there is a change in the audio
     * track selection.
     *
     * <br><br>WMCRefAppUIManagerEvent.AudioTrackSelect event will be triggered
     * along with the current audio track selected present in the event data.
     */
    onAudioTrackSelectChange() {
        this.triggerEvent(WMCRefAppUIManagerEvent.AudioTrackSelect, {
            track: this._uiDOMElement.player.audioTrackSelect.value
        });
    }

    /**
     * @summary
     * Event handler for input and change event for the CC Toggle Switch.
     *
     * @description
     * This event handler is called when the state of the CC Toggle Switch
     * changes.
     *
     * <br><br> WMCRefAppUIManagerEvent.CCToggle will be triggered and along
     * with the CC Toggle Switch "checked" state present in the event data
     */
    onCCToggle() {
        this.triggerEvent(WMCRefAppUIManagerEvent.CCToggle, {
            checked: this._uiDOMElement.player.ccToggle.checked
        });
    }

    /**
     * @summary
     * Event handler for the click of the fullscreen button.
     *
     * @description
     * This event handler is called when the fullscreen button is clicked.
     * On click of the fullscreen button the player container view is either
     * expanded to fullscreen or compressed back to normal size. No events are
     * triggered for this button click.
     */
    onFullscreenButtonClick() {
        if (this._uiDOMElement.player.fullscreenButton.className.includes(FAIconClassName.Expand)) {
            if (this._uiDOMElement.player.playerContainer.requestFullscreen) {
                this._uiDOMElement.player.playerContainer.requestFullscreen();
            } else if (this._uiDOMElement.player.playerContainer.webkitRequestFullscreen) {
                this._uiDOMElement.player.playerContainer.webkitRequestFullscreen();
            } else if (this._uiDOMElement.player.playerContainer.mozRequestFullScreen) {
                this._uiDOMElement.player.playerContainer.mozRequestFullScreen();
            } else if (this._uiDOMElement.player.playerContainer.msRequestFullscreen) {
                this._uiDOMElement.player.playerContainer.msRequestFullscreen();
            }
            this.showConsoleInfo({ message: 'enter fullscreen mode' });
        } else if (this._uiDOMElement.player.fullscreenButton.className.includes(FAIconClassName.Compress)) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (video.msExitFullscreen) {
                document.msExitFullscreen();
            }
            this.showConsoleInfo({ message: 'exit fullscreen mode' });
        }
    }

    /**
     * @summary
     * Event handler for the change event for the fullscreen change.
     *
     * @description
     * This event handler is called after the fullscreen state changes.
     * That is either after going fullscreen or after exiting fullscreen.
     * No events are triggered for this action and this function will toggle
     * the icon of the fullscreen button depending on the current state.
     */
    onFullscreenChange() {
        if (this._uiDOMElement.player.fullscreenButton.className.includes(FAIconClassName.Expand)) {
            this._uiDOMElement.player.fullscreenButton.className = `video-control ${FAIconClassName.Compress}`;
        } else {
            this._uiDOMElement.player.fullscreenButton.className = `video-control ${FAIconClassName.Expand}`;
        }
    }

    /**
     * @summary
     * Event handler for the click event of the Get InHome Status button.
     *
     * @description
     * This event is triggered when the Get InHome Status button is clicked.
     *
     * <br><br>WMCRefAppUIManagerEvent.GetInhomeServerStatusButtonClick will be triggered
     * and the event data will contain the "defaultInhomeStatusValue {string}"
     * and "setInhomeStatusValue {string}" the selected option values from the
     * config form for "Default Status" and "Set Status" respectively.
     */
    onGetInhomeStatusButtonClick() {
        this.triggerEvent(WMCRefAppUIManagerEvent.GetInhomeServerStatusButtonClick, {
            defaultInhomeStatusValue: this._uiDOMElement.config.defaultInhomeStatus.value,
            setInhomeStatusValue: this._uiDOMElement.config.setInhomeStatus.value
        });
    }

    /**
     * @summary
     * Event handler for the click event for the liveNow button.
     *
     * @description
     * This event handler is called whenever the liveNow button is
     * clicked.
     *
     * <br><br><strong>Note:</strong> This button is by default hidden from
     * display. Please call "showLiveNowButton(true)" to make it visible when
     * needed. Similarly "showLiveNowButton(false)" will hide it from display.
     *
     * <br><br> WMCRefAppUIManagerEvent.LiveNowClick event will be triggered.
     */
    onLiveNowButtonClick() {
        this.triggerEvent(WMCRefAppUIManagerEvent.LiveNowClick);
    }

    /**
     * @summary
     * Event handler for the click of the load source config button.
     *
     * @description
     * This event handler is called when the load source config button is clicked.
     * Provide a valid path (JSON file location) for the source list config file
     * on your system, relative to the index.html/imdex_demo.html file and click on
     * "Load" to update the source list in the UI.
     *
     * <br><br>Example: http://localhost:8000/resources/config/source_list_demo.json
     * or "./resources/config/source_list_demo.json" as the path and click on "Load".
     */
    onLoadSourceConfigButtonClick() {
        const sourceConfigPath = this._uiDOMElement.config.loadSourceConfigPath.value.trim();
        if (sourceConfigPath) {
            this.populateSourceListItemsFromConfig(sourceConfigPath);
        }
    }

    /**
     * @summary
     * Event handler for the click event for the loadExternalSource button.
     *
     * @description
     * This event handler is called whenever the loadExternalSource button is
     * clicked.
     *
     * <br><br> WMCRefAppUIManagerEvent.PlayPauseClick event will be triggered.
     */
    onLoadExternalSourceButtonClick() {
        this.triggerEvent(WMCRefAppUIManagerEvent.PlayPauseClick);
    }

    /**
     * @summary
     * Event handler for the change event for the log level selection.
     *
     * @description
     * This event handler is called when there is a change in the log
     * level selection.
     *
     * <br><br>WMCRefAppUIManagerEvent.LogLevelSelect event will be triggered
     * along with the current log level selected present in the event data.
     */
    onLogLevelSelectChange() {
        this.triggerEvent(WMCRefAppUIManagerEvent.LogLevelSelect, {
            logLevel: this._uiDOMElement.player.logLevelSelect.value
        });
    }

    /**
     * @summary
     * Event handler for the change event for the playback speed selection.
     *
     * @description
     * This event handler is called when there is a change in the playback
     * speed selection.
     *
     * <br><br>WMCRefAppUIManagerEvent.PlaybackSpeedSelect event will be triggered
     * along with the current playback speed selected present in the event data.
     */
    onPlaybackSpeedSelectChange() {
        this.triggerEvent(WMCRefAppUIManagerEvent.PlaybackSpeedSelect, {
            speed: this._uiDOMElement.player.playbackSpeedSelect.value
        });
    }

    /**
     * @summary
     * Event handler for mouse enter event over the player container.
     *
     * @description
     * This event handler is called when the mouse enters over the
     * player container surface. When this function is called, the
     * player controls are shown.
     */
    onPlayerContainerMouseEnter() {
        this.showControls(true);
    }

    /**
     * @summary
     * Event handler for mouse leave event over the player container.
     *
     * @description
     * This event handler is called when the mouse exits from over the
     * player container surface. When this function is called the player
     * control will be hidden from display.
     */
    onPlayerContainerMouseExit() {
        // ... but let the controls be visible if player is paused or the settings popup is visible
        if (this._uiDOMElement.player.playPauseButton.className === FAIconClassName.Play ||
            this._uiDOMElement.player.settingsButton.className === FAIconClassName.SettingsSpin) {
            this.showControls(true);
        } else {
            this.showControls(false);
        }
    }

    /**
     * @summary
     * Event handler for the click event for the playPause button.
     *
     * @description
     * This event handler is called whenever the playPause button is
     * clicked.
     *
     * <br><br> WMCRefAppUIManagerEvent.PlayPauseClick event will be triggered.
     */
    onPlayPauseButtonClick() {
        this.triggerEvent(WMCRefAppUIManagerEvent.PlayPauseClick);
    }

    /**
     * @summary
     * Event handler for the click event for the restart button.
     *
     * @description
     * This event handler is called whenever the restart button is
     * clicked.
     *
     * <br><br> WMCRefAppUIManagerEvent.RestartClick event will be triggered.
     */
    onRestartButtonClick() {
        this.triggerEvent(WMCRefAppUIManagerEvent.RestartClick);
    }

    /**
     * @summary
     * Event handler for the click event of the Set InHome Status button.
     *
     * @description
     * This event is triggered when the Set InHome Status button is clicked.
     *
     * <br><br>WMCRefAppUIManagerEvent.SetInhomeServerStatusButtonClick will be triggered
     * and the event data will contain the "defaultInhomeStatusValue {string}"
     * and "setInhomeStatusValue {string}" the selected option values from the
     * config form for "Default Status" and "Set Status" respectively.
     */
    onSetInhomeStatusButtonClick() {
        this.triggerEvent(WMCRefAppUIManagerEvent.SetInhomeServerStatusButtonClick, {
            defaultInhomeStatusValue: this._uiDOMElement.config.defaultInhomeStatus.value,
            setInhomeStatusValue: this._uiDOMElement.config.setInhomeStatus.value
        });
    }

    /**
     * @summary
     * Event handler for the click event for the settings button.
     *
     * @description
     * This event handler is called whenever the settings button is
     * clicked. No event is triggered on click of this button. The settings
     * menu popup will be presented onscreen when clicked and while the settings
     * menu pop is visible onscreen, the settings icon will continue to spin. So
     * on click of the settings icon, the settings menu popup will be hidden from
     * display and the settings icon will stop spinning.
     */
    onSettingsButtonClick(e) {
        if (this._uiDOMElement.player.settingsMenu.style.transform === "translateX(110%)" ||
            this._uiDOMElement.player.settingsMenu.style.transform === "") {
            this._uiDOMElement.player.settingsMenu.style.transform = "translateX(0)";
            this._uiDOMElement.player.settingsButton.className = `video-control ${FAIconClassName.SettingsSpin}`;
        } else {
            this._uiDOMElement.player.settingsMenu.style.transform = "translateX(110%)";
            this._uiDOMElement.player.settingsButton.className = `video-control ${FAIconClassName.Settings}`;
        }
    }

    /**
     * @summary
     * Clear showing popup model
     *
     * @description
     * This event handler to clear error popup model
     */
     onCloseButtonClick(e) {
        this.clearErrorMessage();
    }

    /**
     * @summary
     * Event handler for the click event for the skip advertisement.
     *
     * @description
     * This event handler is called whenever the skip advertisement is clicked.
     *
     * <br><br> WMCRefAppUIManagerEvent.SkipAdvertisementButtonClick event will be triggered.
     */
    onSkipAdButtonClick() {
        this.triggerEvent(WMCRefAppUIManagerEvent.SkipAdvertisementButtonClick);
    }

    /**
     * @summary
     * Event handler update EventStream Data.
     *
     * @description
     * This event handler is called whenever comming EventStream Data during advertisement.
     *
     * @param {object} eventObj an object containing event specific data
     */
    updateEventStreams(eventData = {}) {
        isAdSkipped = eventData.isAdSkipped ? eventData.isAdSkipped : false;
        switch (eventData.id) {
            case "0": // "Ad impression event received"
                let adSpot = 1;
                const adCount = (this._markers && this._markers.actualDAStartTimeList.length) || 1;
                if (this._markers && this._markers.actualDAStartTimeList) {

                    this._markers.actualDAStartTimeList.forEach((adTime, index) => {
                        if (index > 0
                            && adTime <= eventData.playerCurrentTime
                            && this._markers.actualDAStartTimeList[index + 1]
                            && this._markers.actualDAStartTimeList[index + 1] > eventData.playerCurrentTime) {
                            adSpot = index + 1;
                        }
                    });
                }
                isAdSkipped = false;
                this.disableVideoControls(!isAdSkipped);
                this._uiDOMElement.player.showAd.innerHTML = `${adSpot} of ${adCount} Ads `
                this._uiDOMElement.player.advertisementSkip.style.display = "block";
                this._uiDOMElement.player.showAd.style.display = "block";
                this._uiDOMElement.player.skipAd.style.display = "none";
                break;
            case "1": // "Ad first quartile event received" :: Show "Skip Ads"
                this._uiDOMElement.player.advertisementSkip.style.display = "block";
                this._uiDOMElement.player.showAd.style.display = "none";
                this._uiDOMElement.player.skipAd.style.display = "block";
                this.disableVideoControls(!isAdSkipped);
                break;
            case "2": // "Ad midpoint quartile event received"
            case "3": // "Ad third quartile event received",
                this.disableVideoControls(!isAdSkipped);
                break;
            case "4": // "Ad complete event received"
                isAdSkipped = true;
                break;
        }

        if (eventData.isLive) {
            this._uiDOMElement.player.advertisementSkip.style.right = "110px";
        } else {
            this._uiDOMElement.player.advertisementSkip.style.right = "15px";
        }

        if (isAdSkipped) {
            this.disableVideoControls(!isAdSkipped);
            this._uiDOMElement.player.advertisementSkip.style.display = this._uiDOMElement.player.showAd.style.display = this._uiDOMElement.player.skipAd.style.display = "none";
        }
    }

    /**
     * @summary
     * Disabled TrickButtons during Advertisement
     *
     * @description
     * Enabled/Disabled TrickButtons during Advertisement
     *
     * @param {boolean} isDisabled disabled/enable trick button during advertisement
     */
    disableVideoControls(isDisabled) {
        this._uiDOMElement.player.restartButton.disabled = isDisabled;
        this._uiDOMElement.player.skipBackButton.disabled = isDisabled;
        this._uiDOMElement.player.playPauseButton.disabled = isDisabled;
        // this._uiDOMElement.player.stopButton.disabled = isDisabled; // BUG-1222242
        this._uiDOMElement.player.skipForwardButton.disabled = isDisabled;
        if (typeof SpatialNavigation !== "undefined" && this.lastClickedControl) {
            this.lastClickedControl.focus();
        }
    }

    /**
     * @summary
     * Disabled Seek controls during seek
     *
     * @description
     * Enabled/Disabled Seek controls during seek
     *
     * @param {boolean} isDisabled disabled/enable seek controls during seek
     */
    disableSeekControls(isDisabled) {
        this._uiDOMElement.player.restartButton.disabled = isDisabled;
        this._uiDOMElement.player.playPauseButton.disabled = isDisabled;
        this._uiDOMElement.player.skipBackButton.disabled = isDisabled;
        this._uiDOMElement.player.skipForwardButton.disabled = isDisabled;
        this._uiDOMElement.player.videoSlider.disabled = isDisabled;
        this._uiDOMElement.player.videoSlider.style.cursor = isDisabled ? "auto" : "pointer";
        if (typeof SpatialNavigation !== "undefined" && this.lastClickedControl) {
            this.lastClickedControl.focus();
        }
    }
    /**
     * @summary
     * Event handler for the click event for the skipBack button.
     *
     * @description
     * This event handler is called whenever the skipBack button is
     * clicked.
     *
     * <br><br> WMCRefAppUIManagerEvent.SkipBackClick event will be triggered.
     */
    onSkipBackButtonClick() {
        this.triggerEvent(WMCRefAppUIManagerEvent.SkipBackClick);
    }

    /**
     * @summary
     * Event handler for the click event for the skipForward button.
     *
     * @description
     * This event handler is called whenever the skipForward button is
     * clicked.
     *
     * <br><br> WMCRefAppUIManagerEvent.SkipForwardClick event will be triggered.
     */
    onSkipForwardButtonClick() {
        this.triggerEvent(WMCRefAppUIManagerEvent.SkipForwardClick);
    }

    /**
     * @summary
     * Event handler for the click event for the stop button.
     *
     * @description
     * This event handler is called whenever the stop button is
     * clicked.
     *
     * <br><br> WMCRefAppUIManagerEvent.StopClick event will be triggered.
     */
    onStopButtonClick() {
        this.triggerEvent(WMCRefAppUIManagerEvent.StopClick);
    }

    /**
     * @summary
     * Event handler for the change event for the subtitle track selection.
     *
     * @description
     * This event handler is called when there is a change in the subtitle
     * track selection.
     *
     * <br><br>WMCRefAppUIManagerEvent.SubtitleTrackSelect event will be triggered
     * along with the current subtitle track selected present in the event data.
     */
    onSubtitleTrackSelectChange() {
        this.triggerEvent(WMCRefAppUIManagerEvent.SubtitleTrackSelect, {
            track: this._uiDOMElement.player.subtitleTrackSelect.value
        });
    }

    /**
     * @summary
     * Event handler for the change event when the video slider knob is moved/dragged.
     *
     * @description
     * This event handler is called when the video slider knob position is changed. This
     * is fired typically after the slider knob is moved due to user input and placed at
     * the new position offset on the video slider.
     *
     * <br><br> WMCRefAppUIManagerEvent.VideoSliderPositionChange event will be triggered
     * along with the current position present in the event data.
     */
    onVideoSliderChange() {
        if (isAdSkipped) {
            this.triggerEvent(WMCRefAppUIManagerEvent.VideoSliderPositionChange, {
                position: this._uiDOMElement.player.videoSlider.value
            });
        } else {
            this.toastMessage(`Seek is not allow during advertisement`);
        }
    }

    /**
     * @summary
     * Event handler for the input event when the video slider knob is moved/dragged.
     *
     * @description
     * This event handler is called when the user moves the video slider knob. This
     * is fired typically after the slider knob is moved due to user input and placed at
     * the new position offset on the video slider.
     */
    onVideoSliderInput() {
        this.triggerEvent(WMCRefAppUIManagerEvent.VideoSliderInputChange);
    }

    /**
     * @summary
     * Event handler for the click event for the volume button.
     *
     * @description
     * This event handler is called whenever the volume button is
     * clicked.
     *
     * <br><br> WMCRefAppUIManagerEvent.VolumeToggleClick event will be triggered.
     */
    onVolumeButtonClick() {
        this.triggerEvent(WMCRefAppUIManagerEvent.VolumeToggleClick, {
            // if the current volume icon is not FAIconClass.VolumeMute, then this means that volume is active (unmuted)
            // so we send mute = true so that volume can be muted. Similarly when volume icon is not VolumeMute, we will
            // set mute = false
            mute: this._uiDOMElement.player.volumeButton.className === FAIconClassName.VolumeMute ? false : true
        });
    }

    /**
     * @summary
     * Event handler for the change event when the volume slider knob is moved/dragged.
     *
     * @description
     * This event handler is called when the volume slider knob position is changed. This
     * is fired typically after the slider knob is moved due to user input and placed at
     * the new position offset on the volume slider.
     *
     * <br><br> WMCRefAppUIManagerEvent.VolumeSliderPositionChange event will be triggered
     * along with the current volume level present in the event data.
     */
    onVolumeSliderChange() {
        this.triggerEvent(WMCRefAppUIManagerEvent.VolumeSliderPositionChange, {
            volumeLevel: this._uiDOMElement.player.volumeSlider.value
        });
    }

    /**
     * @summary
     * Event handler for the input event when the volume slider knob is moved/dragged.
     *
     * @description
     * This event handler is called when the user moves the volume slider knob. No events
     * are triggered from here and merely the volume slider progress fill is updated from
     * this event handler. The final position where the video slider knob is placed, at
     * that time the "onVolumeSliderChange" event handler will be notified.
     */
    onVolumeSliderInput() {
        this.updateVolumeControls();
    }

    /**
     * @summary
     * Poupulate the audio tracks.
     *
     * @description
     * Populate the given audio tracks in the audio track selection.
     * Also enable the audio selection if valid audio tracks are
     * available, else hide it from display.
     *
     * @param {Array<string>} audioTracks a list of available audio tracks
     */
    populateAudioTracks(audioTracks) {
        const availableAudioTracks = audioTracks.audioTracks;
        const currentAudioTrack = audioTracks.currentAudioTrack;

        // clear the existing list of options
        this._uiDOMElement.player.audioTrackSelect.options.length = 0;

        if (availableAudioTracks.length) {
            for (let i = 0; i < availableAudioTracks.length; i++) {
                if (currentAudioTrack === availableAudioTracks[i]) {
                    this._uiDOMElement.player.audioTrackSelect.add(new Option(availableAudioTracks[i], availableAudioTracks[i], true, true));
                } else {
                    this._uiDOMElement.player.audioTrackSelect.add(new Option(availableAudioTracks[i]));
                }
            }
            this._uiDOMElement.player.audioTrackSelect.parentElement.style.display = "block";
        } else if (currentAudioTrack) {
            this._uiDOMElement.player.audioTrackSelect.add(new Option(currentAudioTrack));
            this._uiDOMElement.player.audioTrackSelect.parentElement.style.display = "block";
        } else {
            this._uiDOMElement.player.audioTrackSelect.parentElement.style.display = "none";
        }
    }

    /**
     * @summary
     * Populate the source list from the given source list config file.
     *
     * @description
     * Calling this function with a JSON file containing the source lite items will
     * load the config file, parse it and then populate the source list items in the
     * UI. After the source list items are populated, appropriate event listeners to
     * handle click of the source list items are registered so that the registered
     * listeners gets notified of the source list item selection.
     *
     * <br><br> WMCRefAppUIManagerEvent.SourceListItemSelected will be triggered when
     * any source list item is clicked/selected.
     *
     * @param {object} sourceListConfig the JSON file containing the source list items
     */
    populateSourceListItemsFromConfig(sourceListConfig) {
        const _this = this;

        /* handle click of the source list item */
        let onSourceListItemSelected = function (sourceItemId) {
            // sourceItemId is a string like "source-list-item-0", where the last "0" is the index
            // of the source config parameters in the sourceList. So we extract the sourceList index first
            let env = sourceItemId.split("-")[0];
            let index = parseInt(sourceItemId.split("-")[4], 10);
            let configFormUpdated = false; // to know if any UI field was updated
            // update the values in the config form in the UI
            var sourceList = _this._sourceList_env[env];
            if (Object.keys(sourceList[index]).length) {
                if (sourceList[index].hasOwnProperty("externalSourceUrl") && sourceList[index].externalSourceUrl) {
                    _this._uiDOMElement.config.externalSourceUrl.value = sourceList[index].externalSourceUrl;
                    if (sourceList[index].hasOwnProperty("externalSourceLicenseUrl") && sourceList[index].externalSourceLicenseUrl) {
                        _this._uiDOMElement.config.externalSourceLicenseUrl.value = sourceList[index].externalSourceLicenseUrl;
                    } else {
                        _this._uiDOMElement.config.externalSourceLicenseUrl.value = ""; // clear when no license url is available
                    }
                    // clear the other source parameters, because when we have a valid external source populated these values are ignored
                    // by the player, so having them pre filled while playing the external source might get confusion. So we clear all the
                    // source parameters, except playbackMode which we also use to indicate the mode for external sources. Also skip clearing
                    // primaryAccount and tenantId as these are expected to be user input and not from config file - so we leave them be!
                    if (_this._uiDOMElement.config.serverUrl) {
                        _this._uiDOMElement.config.serverUrl.value = "";
                    }
                    if (_this._uiDOMElement.config.ownerUid) {
                        _this._uiDOMElement.config.ownerUid.value = "";
                    }
                    if (_this._uiDOMElement.config.mediaUid) {
                        _this._uiDOMElement.config.mediaUid.value = "";
                    }
                    if (_this._uiDOMElement.config.appToken) {
                        _this._uiDOMElement.config.appToken.value = "";
                    }
                    if (_this._uiDOMElement.config.stsToken) {
                        _this._uiDOMElement.config.stsToken.value = "";
                    }
                    if (_this._uiDOMElement.config.newServerEnabled) {
                        _this._uiDOMElement.config.newServerEnabled.checked = false;
                    }
                    if (_this._uiDOMElement.config.metricsEnabled) {
                        _this._uiDOMElement.config.metricsEnabled.checked = false;
                    }
                    if (_this._uiDOMElement.config.forwardBuffer) {
                        _this._uiDOMElement.config.forwardBuffer.value = "";
                        configFormUpdated = true;
                    }
                    if (_this._uiDOMElement.config.backwardBuffer) {
                        _this._uiDOMElement.config.backwardBuffer.value = "";
                        configFormUpdated = true;
                    }
                    configFormUpdated = true;
                } else {
                    // clear the external source parameters when we are playing an MK internal source stream,
                    // for the same reason as above to avoid confusion. Also as long as any value is present
                    // in these form fields for external source, playback for MK internal sources will not work
                    // as playback for the external source will be attempted by the player. So it is important
                    // that we clear those external source parameters.
                    if (_this._uiDOMElement.config.externalSourceUrl) {
                        _this._uiDOMElement.config.externalSourceUrl.value = "";
                        configFormUpdated = true;
                    }
                    if (_this._uiDOMElement.config.externalSourceLicenseUrl) {
                        _this._uiDOMElement.config.externalSourceLicenseUrl.value = "";
                        configFormUpdated = true;
                    }
                    // populate the source parameters for the MK internal stream
                    if (sourceList[index].hasOwnProperty("serverUrl") && sourceList[index].serverUrl && _this._uiDOMElement.config.serverUrl) {
                        _this._uiDOMElement.config.serverUrl.value = sourceList[index].serverUrl;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("ownerUid") && sourceList[index].ownerUid && _this._uiDOMElement.config.ownerUid) {
                        _this._uiDOMElement.config.ownerUid.value = sourceList[index].ownerUid;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("primaryAccount") && sourceList[index].primaryAccount && _this._uiDOMElement.config.primaryAccount) {
                        _this._uiDOMElement.config.primaryAccount.value = sourceList[index].primaryAccount;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("tenantId") && sourceList[index].tenantId && _this._uiDOMElement.config.tenantId) {
                        _this._uiDOMElement.config.tenantId.value = sourceList[index].tenantId;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("mediaUid") && sourceList[index].mediaUid && _this._uiDOMElement.config.mediaUid) {
                        _this._uiDOMElement.config.mediaUid.value = sourceList[index].mediaUid;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("appToken") && sourceList[index].appToken && _this._uiDOMElement.config.appToken) {
                        _this._uiDOMElement.config.appToken.value = sourceList[index].appToken;
                        configFormUpdated = true;
                    } else {
                        _this._uiDOMElement.config.appToken.value = "";
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("stsToken") && sourceList[index].stsToken && _this._uiDOMElement.config.stsToken) {
                        _this._uiDOMElement.config.stsToken.value = sourceList[index].stsToken;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("inhomeServerUrl") && sourceList[index].inhomeServerUrl && _this._uiDOMElement.config.inhomeServerUrl) {
                        _this._uiDOMElement.config.inhomeServerUrl.value = sourceList[index].inhomeServerUrl;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("inhomeServerToken") && sourceList[index].inhomeServerToken && _this._uiDOMElement.config.inhomeServerToken) {
                        _this._uiDOMElement.config.inhomeServerToken.value = sourceList[index].inhomeServerToken;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("catchupStartTime") && sourceList[index].catchupStartTime && _this._uiDOMElement.config.catchupStartTime) {
                        _this._uiDOMElement.config.catchupStartTime.value = sourceList[index].catchupStartTime;
                        configFormUpdated = true;
                    } else {
                        _this._uiDOMElement.config.catchupStartTime.value = "";
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("newServer") && sourceList[index].newServer && _this._uiDOMElement.config.newServerEnabled) {
                        _this._uiDOMElement.config.newServerEnabled.checked = true;
                        configFormUpdated = true;
                    } else {
                        _this._uiDOMElement.config.newServerEnabled.checked = false;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("metricsEnabled") && sourceList[index].metricsEnabled && _this._uiDOMElement.config.metricsEnabled) {
                        _this._uiDOMElement.config.metricsEnabled.checked = true;
                        configFormUpdated = true;
                    } else {
                        _this._uiDOMElement.config.metricsEnabled.checked = false;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("forwardBuffer") && sourceList[index].forwardBuffer && _this._uiDOMElement.config.forwardBuffer) {
                        _this._uiDOMElement.config.forwardBuffer.value = sourceList[index].forwardBuffer;
                        configFormUpdated = true;
                    } else {
                        _this._uiDOMElement.config.forwardBuffer.value = "";
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("backwardBuffer") && sourceList[index].backwardBuffer && _this._uiDOMElement.config.backwardBuffer) {
                        _this._uiDOMElement.config.backwardBuffer.value = sourceList[index].backwardBuffer;
                        configFormUpdated = true;
                    } else {
                        _this._uiDOMElement.config.backwardBuffer.value = "";
                        configFormUpdated = true;
                    }
                }

                // manifestRetryCount - this is updated by both internal and external source parameters
                if (sourceList[index].hasOwnProperty("manifestRetryCount") && sourceList[index].manifestRetryCount && _this._uiDOMElement.config.manifestRetryCount) {
                    _this._uiDOMElement.config.manifestRetryCount.value = sourceList[index].manifestRetryCount;
                    configFormUpdated = true;
                }

                // manifestRetryInterval - this is updated by both internal and external source parameters
                if (sourceList[index].hasOwnProperty("manifestRetryInterval") && sourceList[index].manifestRetryInterval && _this._uiDOMElement.config.manifestRetryInterval) {
                    _this._uiDOMElement.config.manifestRetryInterval.value = sourceList[index].manifestRetryInterval;
                    configFormUpdated = true;
                }

                // cdnFailoverPercentage - this is updated by both internal source parameters
                if (sourceList[index].hasOwnProperty("cdnFailoverPercentage") && sourceList[index].cdnFailoverPercentage && _this._uiDOMElement.config.cdnFailoverPercentage) {
                    _this._uiDOMElement.config.cdnFailoverPercentage.value = sourceList[index].cdnFailoverPercentage;
                    configFormUpdated = true;
                }

                // playbackMode -- this is updated by both internal and external source parameters
                if (sourceList[index].hasOwnProperty("playbackMode") && sourceList[index].playbackMode) {
                    if (_this._uiDOMElement.config.playbackMode) { // if the page contains playback mode select
                        _this._uiDOMElement.config.playbackMode.value = sourceList[index].playbackMode;
                        configFormUpdated = true;
                    } else { // page does not contain - so let's populate one for the lite version of our page
                        // creating a dummy playbackMode config object as one does not exist in reality (no DOM object for playbackMode)
                        // we create and populate this dummy object so as to pass the playbackMode along with config parameters to be
                        // used at the time of setting up the player.
                        _this._uiDOMElement.config.playbackMode = {
                            type: "select",
                            value: sourceList[index].playbackMode
                        };
                    }
                }

                // notify the listeners that a new source item has been selected and the UI form is updated
                if (configFormUpdated) {
                    configSaver.refreshCurrentConfig();
                    _this.triggerEvent(WMCRefAppUIManagerEvent.SourceListItemSelected);
                }
            }
            _this.lastClickedControl = _this._uiDOMElement.player.stopButton;
        };

        /* called after the config file is loaded to populate the source list items and add the event handlers */
        let populateSourceListItems = function (sourceList) {
            // update our main list
            _this._sourceList_env = sourceList;

            if (_this._uiDOMElement.sourceList.list) {
                // clear any previous source list items
                while (_this._uiDOMElement.sourceList.list.firstChild) {
                    _this._uiDOMElement.sourceList.list.removeChild(_this._uiDOMElement.sourceList.list.lastChild);
                }

                var counter = 0;
                for (var i = 0, envs = Object.keys(_this._sourceList_env), ii = envs.length; i < ii; i++) {
                    var env = envs[i];
                    var envLocator = env.replace(/[^a-zA-Z0-9-]/g, "-");
                    var sourceList = _this._sourceList_env[env];
                    if (!sourceList.length) {
                        continue;
                    }

                    const sourceEnvTabContainer = new DOMParser().parseFromString(
                        `<div class="accordion-item"></div>`,
                        "text/html").body.firstChild;
                    // append the source list item container to the source list
                    if (sourceEnvTabContainer) {
                        _this._uiDOMElement.sourceList.list.appendChild(sourceEnvTabContainer);
                    }

                    var sourceEnvTabContainerElement = _this._uiDOMElement.sourceList.list.lastChild;
                    const sourceEnvTabHeader = new DOMParser().parseFromString(
                        `<h2 class="accordion-header" id="${envLocator}-section">
                            <button class="accordion-button${counter === 0 ? '' : ' collapsed'}" type="button" data-bs-toggle="collapse" 
                                data-bs-target="#${envLocator}-env-card" aria-expanded="${counter === 0 ? true : false}" aria-controls="${envLocator}-env-card">
                                ${env}
                            </button>
                        </h2>`,
                        "text/html").body.firstChild;
                    // append the source list item header to the source list item container
                    if (sourceEnvTabHeader) {
                        sourceEnvTabContainerElement.appendChild(sourceEnvTabHeader);
                    }

                    const sourceEnvTabBody = new DOMParser().parseFromString(
                        `<div id="${envLocator}-env-card" class="accordion-collapse collapse${counter === 0 ? ' show' : ''}"
                            aria-labelledby="${envLocator}-section" data-bs-parent="#source-list-accordion">
                                <div class="accordion-body">
                                    <div class="list-group source-list" id="${env}-source-list">
                                        <!-- JavaScript will populate the source list items if a valid source list config is fed to it. -->
                                    </div>
                                </div>    
                        </div>`,
                        "text/html").body.firstChild;

                    // append the source list item body to the source list item container
                    if (sourceEnvTabBody) {
                        sourceEnvTabContainerElement.appendChild(sourceEnvTabBody);
                    }

                    var sourceEnvTabElement = document.getElementById(`${env}-source-list`);

                    // populate the list
                    for (let index = 0; index < sourceList.length; index++) {
                        //construct the source list item
                        const mode = sourceList[index].hasOwnProperty("playbackMode") && sourceList[index].playbackMode ? sourceList[index].playbackMode : "";
                        const serverMode = sourceList[index].hasOwnProperty("newServer") && sourceList[index].newServer ? sourceList[index].newServer : false;
                        const title = sourceList[index].hasOwnProperty("title") && sourceList[index].title ? sourceList[index].title : "Source Item";
                        let sourceUrl = "";
                        if (sourceList[index].hasOwnProperty("externalSourceUrl") && sourceList[index].externalSourceUrl) {
                            sourceUrl = sourceList[index].externalSourceUrl;
                        } else if (sourceList[index].hasOwnProperty("serverUrl") && sourceList[index].serverUrl) {
                            sourceUrl = sourceList[index].serverUrl;
                        }
                        const sourceListItem = new DOMParser().parseFromString(
                            `<a id="${env}-source-list-item-${index}" role="button" class="list-group-item list-group-item-action flex-column align-items-start source-list-item">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-2 h6 asset-title">${title}</h6>
                                    <span class="badge ${mode.toLowerCase() === 'vod' ? 'bg-success' : 'bg-warning'}">${mode} [${serverMode === true ? 'v2' : 'v1'}]</span>
                                </div>
                                <small>${sourceUrl}</small>
                            </a>`,
                            "text/html"
                        ).body.firstChild;

                        // append the source list item to the source list
                        if (sourceListItem) {
                            sourceEnvTabElement.appendChild(sourceListItem);
                        }
                    }
                    counter++;
                }

                // finally register the event listeners to enable selection of source list item on click
                const sourceItemList = document.querySelectorAll(".source-list-item");
                sourceItemList.forEach((item) => {
                    item.addEventListener('click', event => {
                        // Remove 'active' tag for all source items
                        for (let i = 0; i < sourceItemList.length; i++) {
                            sourceItemList[i].classList.remove("active");
                        }

                        // Add 'active' tag for currently selected item
                        item.classList.add("active");

                        // call the source item selection handler
                        onSourceListItemSelected(item.id);
                    });
                });
            }
        };

        /* called after the config file is loaded to populate the source list items and add the event handlers */
        let populateRetailSourceListItems = function (sourceList) {
            // update our main list
            if (_this._sourceList_env && Object.keys(_this._sourceList_env).length) {
                for (var j = 0, keys = Object.keys(sourceList), jj = keys.length; j < jj; j++) {
                    var key = keys[j];
                    if (_this._sourceList_env.hasOwnProperty(key)) {
                        _this._sourceList_env[key] = _this._sourceList_env[key].concat(sourceList[key]);
                    } else {
                        _this._sourceList_env[key] = sourceList[key];
                    }
                }
            } else {
                _this._sourceList_env = sourceList;
            }
            _this._uiDOMElement.sourceList.retailMainContainer.innerHTML = ""
            if (_this._uiDOMElement.sourceList.retailMainContainer) {
                for (var i = 0, envs = Object.keys(_this._sourceList_env), ii = envs.length; i < ii; i++) {
                    var env = envs[i];
                    var sourceList = _this._sourceList_env[env];
                    if (!sourceList.length) {
                        continue;
                    }

                    const rowContainer = new DOMParser().parseFromString(`<div class="row"></div>`,
                        "text/html"
                    ).body.firstChild;
                    if (rowContainer) {
                        _this._uiDOMElement.sourceList.retailMainContainer.appendChild(rowContainer);
                    }

                    var rowDiv = _this._uiDOMElement.sourceList.retailMainContainer.firstChild;

                    const envTitle = new DOMParser().parseFromString(
                        `<div class="alert alert-success d-flex justify-content-between env-title">
                            <h5 class="card-title">${env}</h5>
                        </div>`,
                        "text/html"
                    ).body.firstChild;
                    if (envTitle) {
                        rowDiv.appendChild(envTitle);
                    }

                    // populate the list
                    for (let index = 0; index < sourceList.length; index++) {
                        //construct the source list item
                        const mode = sourceList[index].hasOwnProperty("playbackMode") && sourceList[index].playbackMode ? sourceList[index].playbackMode : "";
                        const title = sourceList[index].hasOwnProperty("title") && sourceList[index].title ? sourceList[index].title : "Source Item";
                        let sourceUrl = "";
                        if (sourceList[index].hasOwnProperty("externalSourceUrl") && sourceList[index].externalSourceUrl) {
                            sourceUrl = sourceList[index].externalSourceUrl;
                        } else if (sourceList[index].hasOwnProperty("serverUrl") && sourceList[index].serverUrl) {
                            sourceUrl = sourceList[index].serverUrl;
                        }

                        const sourceListItem = new DOMParser().parseFromString(
                            `
                            <div id="${env}-source-list-item-${index}" class="col-lg-6 col-xl-3 mb-5 source-list-item">
                                <div class="card h-100 text-center">
                                    <div class="card-header text-end">
                                        <div class="badge ${mode.toLowerCase() === 'vod' ? 'bg-danger' : 'bg-success'}">
                                            ${mode}
                                        </div>
                                        <div class="badge bg-info">
                                            ${env}
                                        </div>
                                    </div>
                                    <div class="card-body">
                                        <h5 class="card-title">${title}</h5>
                                    </div>
                                    <div class="card-footer text-muted overflow-auto">
                                        <p class="text-break">${sourceUrl}</p>
                                        <a href="#" class="stretched-link"></a>
                                    </div>
                                </div>
                            </div>
                            `,
                            "text/html"
                        ).body.firstChild;

                        // append the source list item to the source list
                        if (sourceListItem) {
                            rowDiv.appendChild(sourceListItem);
                        }
                    }
                }

                var playerContainer = document.getElementsByClassName("container-fluid")[0];
                // finally register the event listeners to enable selection of source list item on click
                var sourceListItemArray = document.getElementsByClassName("source-list-item");
                for (var i = 0; i < sourceListItemArray.length; i++) {
                    const item = sourceListItemArray[i];
                    item.addEventListener("click", () => {
                        _this._uiDOMElement.sourceList.retailMainContainer.style.display = "none";
                        playerContainer.style.display = "block";

                        // Select all source items
                        let sourceItems = document.getElementsByClassName("source-list-item");

                        // Remove 'active' tag for all source items
                        for (let i = 0; i < sourceItems.length; i++) {
                            sourceItems[i].classList.remove("active");
                        }

                        // Add 'active' tag for currently selected item
                        item.classList.add("active");
                        // call the source item selection handler
                        onSourceListItemSelected(item.id);
                    });
                }

                if (!_this.counter) {
                    document.getElementById("back-button").addEventListener("click", () => {
                        _this.onStopButtonClick();
                        _this._uiDOMElement.sourceList.retailMainContainer.style.display = "grid";
                        if (_this._uiDOMElement.sourceList.retailMainContainer.style.display == "none") {
                            _this._uiDOMElement.sourceList.retailMainContainer.style.display = "block";
                        }
                        playerContainer.style.display = "none";
                        _this.lastClickedAsset.focus();
                    });
                    document.addEventListener('keydown', (e) => {
                        if (e.keyCode === 10009 || e.key === "XF86Back") {
                            const mainPageVisible = (document.querySelector(".container-fluid").offsetParent === null);
                            onBack(mainPageVisible ? true : false);
                        } else if (e.keyCode === 13) {
                            if (e.target.type !== 'select-one') {
                                e.preventDefault();
                            }
                            e.target.click();
                            if (e.target.tagName.toLowerCase() === "div") {
                                _this.lastClickedAsset = e.target;
                            } else {
                                _this.lastClickedControl = e.target;
                            }
                        }
                    });

                    SpatialNavigation.init();
                    SpatialNavigation.add({
                        id: 'source-list-items',
                        selector: '.source-list-item>div',
                    });
                    SpatialNavigation.add({
                        id: 'video-control-buttons',
                        selector: '#video-control-buttons .video-control',
                        // Focus the last focused element first then entering this section.
                        enterTo: 'last-focused'
                    });
                    SpatialNavigation.add({
                        id: 'ad-skip',
                        selector: 'ad-skip-control[style*="block"]',
                    });
                    SpatialNavigation.add({
                        id: 'settings-menu',
                        selector: '#settings-menu[style="transform: translateX(0px);"] .settings-control',
                        // Since it's a standalone dialog, we restrict its navigation to
                        // itself so the focus won't be moved to another section.
                        restrict: 'self-only',
                        defaultElement: '#log-level-select',
                        enterTo: 'default-element'
                    });
                    SpatialNavigation.add({
                        id: 'back-button',
                        selector: '#back-button'
                    });
                }

                _this.counter++;
            }

            function onBack(exitApp) {
                if (exitApp) {
                    document.querySelector("#exit-dialog-button").click();
                    const modal = document.querySelector(".modal");
                    modal.addEventListener("transitionend", (e) => {
                        modal.querySelector("button").focus();
                    });
                } else {
                    const settingsVisible = document.querySelector('#settings-menu[style="transform: translateX(0px);"]');
                    if (settingsVisible) {
                        return;
                    } else {
                        document.querySelector("#back-button").click();
                    }
                }
            }

            // Scroll to top on TV in case of partial scroll up
            window.onscroll = function (e) {
                if (this.oldScroll > this.scrollY && this.scrollY < 100) {
                    window.scrollTo(0, 0);
                }
                this.oldScroll = this.scrollY;
            }

            // Set everything with "tabindex=-1".
            SpatialNavigation.makeFocusable();

            // Set first visible element in focus".
            SpatialNavigation.focus();
        };

        // attempt to load the source config and populate the source list is available in the UI
        if (sourceListConfig) {
            if (window.location.pathname.split("/").pop().split(".")[0] === "index_retail") {
                // clear any previous source list items
                _this._uiDOMElement.sourceList.retailMainContainer.innerHTML = "";
                _this.counter = 0;
                var sourceListConfig = "resources/config/source_list.json";
                this.loadConfigFile(sourceListConfig, populateRetailSourceListItems);
                sourceListConfig = "resources/config/source_list_external.json";
                this.loadConfigFile(sourceListConfig, populateRetailSourceListItems);
            } else if (this._uiDOMElement.sourceList.list) {
                this.loadConfigFile(sourceListConfig, populateSourceListItems);
            }
        } else {
            console.log(WMCRefAppUIManager_TAG, "Invalid parameters, cannot populate the source list items!");
        }
    }

    /**
     * @summary
     * Populate the source list from the given source list config file.
     *
     * @description
     * Calling this function on file input change will
     * load the local config file, parse it and then populate the source list items in the
     * UI. After the source list items are populated, appropriate event listeners to
     * handle click of the source list items are registered so that the registered
     * listeners gets notified of the source list item selection.
     *
     * <br><br> WMCRefAppUIManagerEvent.SourceListItemSelected will be triggered when
     * any source list item is clicked/selected.
     *
     */

    onLoadSourceConfigFilePathChange() {
        const _this = this;
        /* handle click of the source list item */
        let onSourceListItemSelected = function (sourceItemId) {
            // sourceItemId is a string like "source-list-item-0", where the last "0" is the index
            // of the source config parameters in the sourceList. So we extract the sourceList index first
            let env = sourceItemId.split("-")[0];
            let index = parseInt(sourceItemId.split("-")[4], 10);
            let configFormUpdated = false; // to know if any UI field was updated

            // update the values in the config form in the UI
            var sourceList = _this._sourceList_env[env];
            if (Object.keys(sourceList[index]).length) {
                if (sourceList[index].hasOwnProperty("externalSourceUrl") && sourceList[index].externalSourceUrl) {
                    _this._uiDOMElement.config.externalSourceUrl.value = sourceList[index].externalSourceUrl;
                    if (sourceList[index].hasOwnProperty("externalSourceLicenseUrl") && sourceList[index].externalSourceLicenseUrl) {
                        _this._uiDOMElement.config.externalSourceLicenseUrl.value = sourceList[index].externalSourceLicenseUrl;
                    } else {
                        _this._uiDOMElement.config.externalSourceLicenseUrl.value = ""; // clear when no license url is available
                    }
                    // clear the other source parameters, because when we have a valid external source populated these values are ignored
                    // by the player, so having them pre filled while playing the external source might get confusion. So we clear all the
                    // source parameters, except playbackMode which we also use to indicate the mode for external sources. Also skip clearing
                    // primaryAccount and tenantId as these are expected to be user input and not from config file - so we leave them be!
                    if (_this._uiDOMElement.config.serverUrl) {
                        _this._uiDOMElement.config.serverUrl.value = "";
                    }
                    if (_this._uiDOMElement.config.ownerUid) {
                        _this._uiDOMElement.config.ownerUid.value = "";
                    }
                    if (_this._uiDOMElement.config.mediaUid) {
                        _this._uiDOMElement.config.mediaUid.value = "";
                    }
                    if (_this._uiDOMElement.config.appToken) {
                        _this._uiDOMElement.config.appToken.value = "";
                    }
                    if (_this._uiDOMElement.config.stsToken) {
                        _this._uiDOMElement.config.stsToken.value = "";
                    }
                    if (_this._uiDOMElement.config.newServerEnabled) {
                        _this._uiDOMElement.config.newServerEnabled.checked = false;
                    }
                    if (_this._uiDOMElement.config.metricsEnabled) {
                        _this._uiDOMElement.config.metricsEnabled.checked = false;
                    }
                    if (_this._uiDOMElement.config.forwardBuffer) {
                        _this._uiDOMElement.config.forwardBuffer.value = "";
                        configFormUpdated = true;
                    }
                    if (_this._uiDOMElement.config.backwardBuffer) {
                        _this._uiDOMElement.config.backwardBuffer.value = "";
                        configFormUpdated = true;
                    }
                    configFormUpdated = true;
                } else {
                    // clear the external source parameters when we are playing an MK internal source stream,
                    // for the same reason as above to avoid confusion. Also as long as any value is present
                    // in these form fields for external source, playback for MK internal sources will not work
                    // as playback for the external source will be attempted by the player. So it is important
                    // that we clear those external source parameters.
                    if (_this._uiDOMElement.config.externalSourceUrl) {
                        _this._uiDOMElement.config.externalSourceUrl.value = "";
                        configFormUpdated = true;
                    }
                    if (_this._uiDOMElement.config.externalSourceLicenseUrl) {
                        _this._uiDOMElement.config.externalSourceLicenseUrl.value = "";
                        configFormUpdated = true;
                    }
                    // populate the source parameters for the MK internal stream
                    if (sourceList[index].hasOwnProperty("serverUrl") && sourceList[index].serverUrl && _this._uiDOMElement.config.serverUrl) {
                        _this._uiDOMElement.config.serverUrl.value = sourceList[index].serverUrl;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("ownerUid") && sourceList[index].ownerUid && _this._uiDOMElement.config.ownerUid) {
                        _this._uiDOMElement.config.ownerUid.value = sourceList[index].ownerUid;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("primaryAccount") && sourceList[index].primaryAccount && _this._uiDOMElement.config.primaryAccount) {
                        _this._uiDOMElement.config.primaryAccount.value = sourceList[index].primaryAccount;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("tenantId") && sourceList[index].tenantId && _this._uiDOMElement.config.tenantId) {
                        _this._uiDOMElement.config.tenantId.value = sourceList[index].tenantId;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("mediaUid") && sourceList[index].mediaUid && _this._uiDOMElement.config.mediaUid) {
                        _this._uiDOMElement.config.mediaUid.value = sourceList[index].mediaUid;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("appToken") && sourceList[index].appToken && _this._uiDOMElement.config.appToken) {
                        _this._uiDOMElement.config.appToken.value = sourceList[index].appToken;
                        configFormUpdated = true;
                    } else {
                        _this._uiDOMElement.config.appToken.value = "";
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("stsToken") && sourceList[index].stsToken && _this._uiDOMElement.config.stsToken) {
                        _this._uiDOMElement.config.stsToken.value = sourceList[index].stsToken;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("inhomeServerUrl") && sourceList[index].inhomeServerUrl && _this._uiDOMElement.config.inhomeServerUrl) {
                        _this._uiDOMElement.config.inhomeServerUrl.value = sourceList[index].inhomeServerUrl;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("inhomeServerToken") && sourceList[index].inhomeServerToken && _this._uiDOMElement.config.inhomeServerToken) {
                        _this._uiDOMElement.config.inhomeServerToken.value = sourceList[index].inhomeServerToken;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("catchupStartTime") && sourceList[index].catchupStartTime && _this._uiDOMElement.config.catchupStartTime) {
                        _this._uiDOMElement.config.catchupStartTime.value = sourceList[index].catchupStartTime;
                        configFormUpdated = true;
                    } else {
                        _this._uiDOMElement.config.catchupStartTime.value = "";
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("newServer") && sourceList[index].newServer && _this._uiDOMElement.config.newServerEnabled) {
                        _this._uiDOMElement.config.newServerEnabled.checked = true;
                        configFormUpdated = true;
                    } else {
                        _this._uiDOMElement.config.newServerEnabled.checked = false;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("metricsEnabled") && sourceList[index].metricsEnabled && _this._uiDOMElement.config.metricsEnabled) {
                        _this._uiDOMElement.config.metricsEnabled.checked = true;
                        configFormUpdated = true;
                    } else {
                        _this._uiDOMElement.config.metricsEnabled.checked = false;
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("forwardBuffer") && sourceList[index].forwardBuffer && _this._uiDOMElement.config.forwardBuffer) {
                        _this._uiDOMElement.config.forwardBuffer.value = sourceList[index].forwardBuffer;
                        configFormUpdated = true;
                    } else {
                        _this._uiDOMElement.config.forwardBuffer.value = "";
                        configFormUpdated = true;
                    }
                    if (sourceList[index].hasOwnProperty("backwardBuffer") && sourceList[index].backwardBuffer && _this._uiDOMElement.config.backwardBuffer) {
                        _this._uiDOMElement.config.backwardBuffer.value = sourceList[index].backwardBuffer;
                        configFormUpdated = true;
                    } else {
                        _this._uiDOMElement.config.backwardBuffer.value = "";
                        configFormUpdated = true;
                    }
                }

                // manifestRetryCount - this is updated by both internal and external source parameters
                if (sourceList[index].hasOwnProperty("manifestRetryCount") && sourceList[index].manifestRetryCount && _this._uiDOMElement.config.manifestRetryCount) {
                    _this._uiDOMElement.config.manifestRetryCount.value = sourceList[index].manifestRetryCount;
                    configFormUpdated = true;
                }

                // manifestRetryInterval - this is updated by both internal and external source parameters
                if (sourceList[index].hasOwnProperty("manifestRetryInterval") && sourceList[index].manifestRetryInterval && _this._uiDOMElement.config.manifestRetryInterval) {
                    _this._uiDOMElement.config.manifestRetryInterval.value = sourceList[index].manifestRetryInterval;
                    configFormUpdated = true;
                }

                // cdnFailoverPercentage - this is updated by both internal source parameters
                if (sourceList[index].hasOwnProperty("cdnFailoverPercentage") && sourceList[index].cdnFailoverPercentage && _this._uiDOMElement.config.cdnFailoverPercentage) {
                    _this._uiDOMElement.config.cdnFailoverPercentage.value = sourceList[index].cdnFailoverPercentage;
                    configFormUpdated = true;
                }

                // playbackMode -- this is updated by both internal and external source parameters
                if (sourceList[index].hasOwnProperty("playbackMode") && sourceList[index].playbackMode) {
                    if (_this._uiDOMElement.config.playbackMode) { // if the page contains playback mode select
                        _this._uiDOMElement.config.playbackMode.value = sourceList[index].playbackMode;
                        configFormUpdated = true;
                    } else { // page does not contain - so let's populate one for the lite version of our page
                        // creating a dummy playbackMode config object as one does not exist in reality (no DOM object for playbackMode)
                        // we create and populate this dummy object so as to pass the playbackMode along with config parameters to be
                        // used at the time of setting up the player.
                        _this._uiDOMElement.config.playbackMode = {
                            type: "select",
                            value: sourceList[index].playbackMode
                        };
                    }
                }

                // notify the listeners that a new source item has been selected and the UI form is updated
                if (configFormUpdated) {
                    configSaver.refreshCurrentConfig();
                    _this.triggerEvent(WMCRefAppUIManagerEvent.SourceListItemSelected);
                }
            }
        };

        /* called after the config file is loaded to populate the source list items and add the event handlers */
        let populateSourceListItems = function (sourceList) {
            // update our main list
            _this._sourceList_env = sourceList;

            if (_this._uiDOMElement.sourceList.list) {
                // clear any previous source list items
                while (_this._uiDOMElement.sourceList.list.firstChild) {
                    _this._uiDOMElement.sourceList.list.removeChild(_this._uiDOMElement.sourceList.list.lastChild);
                }

                var counter = 0;
                for (var i = 0, envs = Object.keys(_this._sourceList_env), ii = envs.length; i < ii; i++) {
                    var env = envs[i];
                    var envLocator = env.replace(/[^a-zA-Z0-9-]/g, "-");
                    var sourceList = _this._sourceList_env[env];
                    if (!sourceList.length) {
                        continue;
                    }

                    const sourceEnvTabContainer = new DOMParser().parseFromString(
                        `<div class="accordion-item"></div>`,
                        "text/html").body.firstChild;
                    // append the source list item container to the source list
                    if (sourceEnvTabContainer) {
                        _this._uiDOMElement.sourceList.list.appendChild(sourceEnvTabContainer);
                    }

                    var sourceEnvTabContainerElement = _this._uiDOMElement.sourceList.list.lastChild;
                    const sourceEnvTabHeader = new DOMParser().parseFromString(
                        `<h2 class="accordion-header" id="${envLocator}-section">
                            <button class="accordion-button${counter === 0 ? '' : ' collapsed'}" type="button" data-bs-toggle="collapse" 
                                data-bs-target="#${envLocator}-env-card" aria-expanded="true" aria-controls="${envLocator}-env-card">
                                ${env}
                            </button>
                        </h2>`,
                        "text/html").body.firstChild;
                    // append the source list item header to the source list item container
                    if (sourceEnvTabHeader) {
                        sourceEnvTabContainerElement.appendChild(sourceEnvTabHeader);
                    }

                    const sourceEnvTabBody = new DOMParser().parseFromString(
                        `<div id="${envLocator}-env-card" class="accordion-collapse collapse${counter === 0 ? ' show' : ''}"
                            aria-labelledby="${envLocator}-section" data-bs-parent="#source-list-accordion">
                                <div class="accordion-body">
                                    <div class="list-group source-list" id="${env}-source-list">
                                        <!-- JavaScript will populate the source list items if a valid source list config is fed to it. -->
                                    </div>
                                </div>    
                        </div>`,
                        "text/html").body.firstChild;

                    // append the source list item body to the source list item container
                    if (sourceEnvTabBody) {
                        sourceEnvTabContainerElement.appendChild(sourceEnvTabBody);
                    }

                    var sourceEnvTabElement = document.getElementById(`${env}-source-list`);

                    // populate the list
                    for (let index = 0; index < sourceList.length; index++) {
                        //construct the source list item
                        const mode = sourceList[index].hasOwnProperty("playbackMode") && sourceList[index].playbackMode ? sourceList[index].playbackMode : "";
                        const title = sourceList[index].hasOwnProperty("title") && sourceList[index].title ? sourceList[index].title : "Source Item";
                        let sourceUrl = "";
                        if (sourceList[index].hasOwnProperty("externalSourceUrl") && sourceList[index].externalSourceUrl) {
                            sourceUrl = sourceList[index].externalSourceUrl;
                        } else if (sourceList[index].hasOwnProperty("serverUrl") && sourceList[index].serverUrl) {
                            sourceUrl = sourceList[index].serverUrl;
                        }
                        const sourceListItem = new DOMParser().parseFromString(
                            `<a id="${env}-source-list-item-${index}" role="button" class="list-group-item list-group-item-action flex-column align-items-start source-list-item">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-2 h6">${title}</h6>
                                    <span class="badge ${mode.toLowerCase() === 'vod' ? 'bg-warning' : 'bg-success'}">${mode}</span>
                                </div>
                                <small>${sourceUrl}</small>
                            </a>`,
                            "text/html"
                        ).body.firstChild;

                        // append the source list item to the source list
                        if (sourceListItem) {
                            sourceEnvTabElement.appendChild(sourceListItem);
                        }
                    }
                }

                // finally register the event listeners to enable selection of source list item on click
                const sourceItemList = document.querySelectorAll(".source-list-item");
                sourceItemList.forEach((item) => {
                    item.addEventListener('click', event => {
                        // Remove 'active' tag for all source items
                        for (let i = 0; i < sourceItemList.length; i++) {
                            sourceItemList[i].classList.remove("active");
                        }

                        // Add 'active' tag for currently selected item
                        item.classList.add("active");

                        // call the source item selection handler
                        onSourceListItemSelected(item.id);
                    });
                });
            }
        };

        var localFileReader = new FileReader();
        localFileReader.onload = function () {
            populateSourceListItems(JSON.parse(localFileReader.result));
        }
        localFileReader.readAsText(this._uiDOMElement.config.loadSourceConfigFilePath.files[0]);
    }

    /**
     * @summary
     * Populate the subtitle tracks.
     *
     * @description
     * Populate the given subtitle tracks in the subtitle track selection.
     * Also enable the subtitle selection if valid subtitle tracks are
     * available, else hide it from display.
     *
     * @param {Array<string>} subtitleTracks a list of available subtitle tracks
     */
    populateSubtitleTracks(subtitleTracks, currentTrack) {
        if (subtitleTracks.length) {
            this._uiDOMElement.player.subtitleTrackSelect.options.length = 0; // clear the existing list of options
            this._uiDOMElement.player.subtitleTrackSelect.add(new Option("off", "off", true, true));
            for (let i = 0; i < subtitleTracks.length; i++) {
                this._uiDOMElement.player.subtitleTrackSelect.add(new Option(subtitleTracks[i], subtitleTracks[i], false, subtitleTracks[i] === currentTrack));
            }
            this._uiDOMElement.player.subtitleTrackSelect.parentElement.style.display = "block";
            this._uiDOMElement.player.ccToggle.disabled = true;
        } else {
            this._uiDOMElement.player.subtitleTrackSelect.options.length = 0;
            this._uiDOMElement.player.subtitleTrackSelect.parentElement.style.display = "none";
            this._uiDOMElement.player.ccToggle.disabled = false;
        }
    }

    /**
     * @summary
     * Unregister from listening to the given event type.
     *
     * @description
     * Remove the event listener to stop getting event notifications for the said event.
     *
     * @param {WMCRefAppUIManagerEvent} eventType the event type
     * @param {Function} listener the event listener
     */
    removeEventListener(eventType, listener) {
        if (!eventType || typeof listener !== "function") {
            console.log(WMCRefAppUIManager_TAG, "removeEventListener: Invalid parameters!");
            return;
        }
        for (let i = 0; i < this._eventListeners.length; i++) {
            if (eventType === this._eventListeners[i].eventType && listener === this._eventListeners[i].listener) {
                this._eventListeners.splice(i, 1);
            }
        }
    }

    /**
     * @summary
     * Reset the player controls.
     *
     * @description
     * Bring the player controls to its initial setting.
     */
    resetControls() {
        this.showPlayIcon();
        this.exitFullscreen();
        this.showSpinner(false);
        this.hideSettingsMenu();
        this.updateProgramTime();
        this.resetPlayerMetrics();
        this.updateAdMarkersValue();
        this.updateVideoPosition();
        this.showLiveNowButton(false);
        this.populateSubtitleTracks([]);
        this.populateVideoQualities([]);
        this.populateAudioTracks({ audioTracks: [], currentAudioTrack: null });
        this.updateVolumeControls(this._uiDOMElement.player.volumeButton.className === FAIconClassName.VolumeMute ? true : false);
        this.disableVideoControls(false);

        var controls = Object.keys(PlayerControls);
        for (let i = 0; i < controls.length; i++) {
            var control = PlayerControls[controls[i]];
            this.disableEnablePlayerControls(control, false);
        }
    }

    /**
     * @summary
     * Reset or clear the player metric values
     */
    resetPlayerMetrics() {
        let getNotAvailableListItem = function () {
            let listItem = document.createElement("li");
            listItem.textContent = "Not available!";
            return listItem;
        };

        if (this._uiDOMElement.playerMetrics.playerState) {
            this._uiDOMElement.playerMetrics.playerState.textContent = "Idle";
        }
        if (this._uiDOMElement.playerMetrics.startupTime) {
            this._uiDOMElement.playerMetrics.startupTime.textContent = "0";
        }
        if (this._uiDOMElement.playerMetrics.playbackSpeed) {
            // Not resetting this as these values can be persistent across playback and selection
            // is allowed even when player/playback is not ready.
            // this._uiDOMElement.playerMetrics.playbackSpeed.textContent = "1x";
        }
        if (this._uiDOMElement.playerMetrics.videoBufferLength) {
            this._uiDOMElement.playerMetrics.videoBufferLength.textContent = "0";
        }
        if (this._uiDOMElement.playerMetrics.audioBufferLength) {
            this._uiDOMElement.playerMetrics.audioBufferLength.textContent = "0";
        }
        if (this._uiDOMElement.playerMetrics.seekStart) {
            this._uiDOMElement.playerMetrics.seekStart.textContent = "0";
        }
        if (this._uiDOMElement.playerMetrics.seekEnd) {
            this._uiDOMElement.playerMetrics.seekEnd.textContent = "0";
        }
        if (this._uiDOMElement.playerMetrics.seekDuration) {
            this._uiDOMElement.playerMetrics.seekDuration.textContent = "0";
        }
        if (this._uiDOMElement.playerMetrics.closedCaptionsState) {
            // Not resetting this as these values can be persistent across playback and selection
            // is allowed even when player/playback is not ready.
            // this._uiDOMElement.playerMetrics.closedCaptionsState.textContent = "Disabled";
        }
        if (this._uiDOMElement.playerMetrics.videoDroppedFrames) {
            this._uiDOMElement.playerMetrics.videoDroppedFrames.textContent = "0";
        }
        if (this._uiDOMElement.playerMetrics.videoLatency) {
            this._uiDOMElement.playerMetrics.videoLatency.textContent = "0";
        }
        if (this._uiDOMElement.playerMetrics.videoFrameRate) {
            this._uiDOMElement.playerMetrics.videoFrameRate.textContent = "0";
        }
        if (this._uiDOMElement.playerMetrics.videoResolution) {
            this._uiDOMElement.playerMetrics.videoResolution.textContent = "";
        }
        if (this._uiDOMElement.playerMetrics.videoCodec) {
            this._uiDOMElement.playerMetrics.videoCodec.textContent = "";
        }
        if (this._uiDOMElement.playerMetrics.audioCodec) {
            this._uiDOMElement.playerMetrics.audioCodec.textContent = "";
        }
        if (this._uiDOMElement.playerMetrics.videoQualities) {
            this._uiDOMElement.playerMetrics.videoQualities.innerHTML = "";
            this._uiDOMElement.playerMetrics.videoQualities.appendChild(getNotAvailableListItem());
        }
        if (this._uiDOMElement.playerMetrics.audioTracks) {
            this._uiDOMElement.playerMetrics.audioTracks.innerHTML = "";
            this._uiDOMElement.playerMetrics.audioTracks.appendChild(getNotAvailableListItem());
        }
        if (this._uiDOMElement.playerMetrics.subtitleTracks) {
            this._uiDOMElement.playerMetrics.subtitleTracks.innerHTML = "";
            this._uiDOMElement.playerMetrics.subtitleTracks.appendChild(getNotAvailableListItem());
        }
        if (this._uiDOMElement.adEvents.adEventContainerWrapper) {
            this._uiDOMElement.adEvents.adEventContainer.innerHTML = "";
            this._uiDOMElement.adEvents.adEventContainerWrapper.style.display = "none";
        }
        if (this._uiDOMElement.playerMetrics.backendModulesStartupTime) {
            this._uiDOMElement.playerMetrics.backendModulesStartupTime.textContent = "0";
        }
        if (this._uiDOMElement.playerMetrics.bitmovinLoadTime) {
            this._uiDOMElement.playerMetrics.bitmovinLoadTime.textContent = "0";
        }
        if (this._uiDOMElement.playerMetrics.bitmovinRenderTime) {
            this._uiDOMElement.playerMetrics.bitmovinRenderTime.textContent = "0";
        }
    }

    /**
     * @summary
     * Set and display a poster image.
     *
     * @description
     * Sets the given image as the content poster and will display it on the player screen.
     *
     * @param {string} posterImage the file location/path containing the poster image file.
     * Please note that the path to the posterImage is relative to the index.html file
     */
    showContentPoster(posterImage) {
        if (posterImage) {
            this._uiDOMElement.player.posterImage.src = posterImage;
            this._uiDOMElement.player.contentPoster.style.display = "block";
        }
    }

    /**
     * @summary
     * Show or hide the player controls.
     *
     * @param {boolean} show when true, the controls are shown, hidden otherwise
     */
    showControls(show) {
        this._uiDOMElement.player.programTimeContainer.style.opacity = show ? 1 : 0;                           // program time
        this._uiDOMElement.player.videoControls.style.transform = show ? "translateY(0)" : "translateY(45px)"; // rest of the controls
    }

    /**
     * @summary
     * Show an error message.
     *
     * @description
     * An error message with relevant error code will be displayed in the center
     * of the player. This error message will be displayed until it is dismissed
     * by calling clearErrorMessage()
     *
     * @param {number} code the error code
     * @param {string} message the error message
     */
    showErrorMessage(code, message) {
        if (message) {
            this._uiDOMElement.player.errorMessage.textContent = message;
            this._uiDOMElement.player.errorCode.textContent = code ? code : "#DEAD";
            this._uiDOMElement.player.errorMessageContainer.style.display = "block";
        }
    }

    /**
     * @summary
     * Show WMCRefApp Information.
     *
     * @description
     * An error message with relevant error/warn/info code will be displayed in the center
     * of the player.
     *
     * @param {object} options contains code, message & log type
     */
    showConsoleInfo(options = {}) {
        let regex = /^[\d]+$/g;
        options.type = options.type ? options.type : 'debug';

        let msg = '';
        msg += (options.TAG ? `[${options.TAG}]` : '') + `[${options.type}] `;
        msg += regex.test(options.code) ? `Code: ${options.code}, ` : '';
        msg += options.message ? `Message: ${options.message}` : '';

        switch (options.type) {
            case 'info':
                console.info(msg);
                break;
            case 'warn':
                console.warn(msg);
                break;
            case 'error':
                console.error(msg);
                break;
            default:
                console.log(msg);
                break;
        }
    }

    /**
     * @summary
     * Show or hide the liveNow button.
     *
     * @param {boolean} show when true, liveNow button is shown, hidden otherwise
     */
    showLiveNowButton(show) {
        this._uiDOMElement.player.liveNowButton.style.display = show ? "block" : "none";
    }

    /**
     * @summary
     * Show the pause icon in place of the play icon
     */
    showPauseIcon() {
        this._uiDOMElement.player.playPauseButton.className = `video-control ${FAIconClassName.Pause}`;
    }

    /**
     * @summary
     * Show the play icon in place of the pause icon
     */
    showPlayIcon() {
        this._uiDOMElement.player.playPauseButton.className = `video-control ${FAIconClassName.Play}`;
    }

    /**
     * @summary
     * Show or hide the spinner.
     *
     * @param {boolean} show when true, the spinner is shown, hidden otherwise
     */
    showSpinner(show) {
        this._uiDOMElement.player.spinner.style.display = show ? "block" : "none";
    }

    /**
     * @summary
     * Display a toast notification message.
     *
     * @description
     * A short notification message will be displayed on the top right
     * corner of the player for a few seconds (configurable via timeoutMsecs).
     *
     * @param {string} message the message notification
     * @param {number} timeoutMsecs the time value in milliseconds indicating
     * how long the toast message needs to be displayed.
     */
    toastMessage(message, timeoutMsecs = 0) {
        if (message) {
            const _this = this;
            this._uiDOMElement.player.toastMessage.textContent = message;
            this._uiDOMElement.player.toastMessage.style.padding = "10px";
            this._uiDOMElement.player.toastMessage.style.transform = "translateX(0)";
            setTimeout(function () {
                _this._uiDOMElement.player.toastMessage.style.transform = "translateX(110%)";
            }, timeoutMsecs ? timeoutMsecs : 5000); // default timeout in 5 seconds.
        }
    }

    /**
     * @summary
     * Trigger an event to notify registered listeners.
     *
     * @description
     * This function is used to trigger an event to notify the registered
     * listeners of the said event and along with the event notification, event
     * specific data is also passed as a paramter.
     *
     * @param {WMCRefAppUIManagerEvent} eventType the event type
     * @param {object} eventData the event specific data
     */
    triggerEvent(eventType, eventData = {}) {
        if (!eventType) {
            console.log(WMCRefAppUIManager_TAG, "triggerEvent: Invalid event type!");
            return;
        }
        for (let i = 0; i < this._eventListeners.length; i++) {
            if (eventType === this._eventListeners[i].eventType) {
                let payload = Object.assign({
                    eventType: eventType,
                    eventData: eventData
                });
                this._eventListeners[i].listener(payload);
            }
        }
    }

    /**
     * @summary
     * Update the player metrics in the UI
     *
     * @description
     * Update the various player metric parameters on display in the UI
     *
     * @param {object} metrics the object containing various player metric parameters
     */
    updatePlayerMetrics(metrics = {}) {
        let formatBytes = function (bytes, decimals = 2) {
            if (bytes === 0) return "0 bytes";
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ["bytes", "kb", "mb", "gb", "tb", "pb", "eb", "zb", "yb"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i] + "ps";
        };

        if (Object.keys(metrics).length) {
            if (metrics.hasOwnProperty("playerState")) {
                this._uiDOMElement.playerMetrics.playerState.textContent = metrics.playerState;
            }
            if (metrics.hasOwnProperty("startupTime")) {
                this._uiDOMElement.playerMetrics.startupTime.textContent = metrics.startupTime;
            }
            if (metrics.hasOwnProperty("playbackSpeed")) {
                this._uiDOMElement.playerMetrics.playbackSpeed.textContent = `${metrics.playbackSpeed}x`;
            }
            if (metrics.hasOwnProperty("videoBufferLength")) {
                this._uiDOMElement.playerMetrics.videoBufferLength.textContent = metrics.videoBufferLength;
            }
            if (metrics.hasOwnProperty("audioBufferLength")) {
                this._uiDOMElement.playerMetrics.audioBufferLength.textContent = metrics.audioBufferLength;
            }
            if (metrics.hasOwnProperty("closedCaptionsState")) {
                this._uiDOMElement.playerMetrics.closedCaptionsState.textContent = metrics.closedCaptionsState;
            }
            if (metrics.hasOwnProperty("videoQualities")) {
                const availableQualitites = metrics.videoQualities.availableQualitites.sort(function (a, b) { return b - a }); // sorted list with highest quality at the top
                const currentQuality = metrics.videoQualities.currentQuality;
                if (availableQualitites.length) {
                    // clear the list before we update/populate the metrics
                    this._uiDOMElement.playerMetrics.videoQualities.innerHTML = "";

                    for (let i = 0; i < availableQualitites.length; i++) {
                        let listItem = document.createElement("li");
                        if (currentQuality === availableQualitites[i]) {
                            listItem.setAttribute("style", "color: blue; font-weight: bold;");
                        }
                        listItem.textContent = formatBytes(availableQualitites[i]);
                        this._uiDOMElement.playerMetrics.videoQualities.appendChild(listItem);
                    }
                } else {
                    if (currentQuality) {
                        // clear the list before we update/populate the metrics
                        this._uiDOMElement.playerMetrics.videoQualities.innerHTML = "";

                        let listItem = document.createElement("li");
                        listItem.setAttribute("style", "color: blue; font-weight: bold;");
                        listItem.textContent = formatBytes(currentQuality);
                        this._uiDOMElement.playerMetrics.videoQualities.appendChild(listItem);
                    }
                }
            }
            if (metrics.hasOwnProperty("audioTracks")) {
                const availableAudioTracks = metrics.audioTracks.audioTracks;
                const currentAudioTrack = metrics.audioTracks.currentAudioTrack;
                if (availableAudioTracks.length) {
                    // clear the list before we update/populate the metrics
                    this._uiDOMElement.playerMetrics.audioTracks.innerHTML = "";

                    for (let i = 0; i < availableAudioTracks.length; i++) {
                        let listItem = document.createElement("li");
                        if (currentAudioTrack === availableAudioTracks[i]) {
                            listItem.setAttribute("style", "color: blue; font-weight: bold;");
                        }
                        listItem.textContent = availableAudioTracks[i];
                        this._uiDOMElement.playerMetrics.audioTracks.appendChild(listItem);
                    }
                } else {
                    if (currentAudioTrack) {
                        // clear the list before we update/populate the metrics
                        this._uiDOMElement.playerMetrics.audioTracks.innerHTML = "";

                        let listItem = document.createElement("li");
                        listItem.setAttribute("style", "color: blue; font-weight: bold;");
                        listItem.textContent = currentAudioTrack;
                        this._uiDOMElement.playerMetrics.audioTracks.appendChild(listItem);
                    }
                }
            }
            if (metrics.hasOwnProperty("subtitleTracks")) {
                let prepend = function (value, array) {
                    var newArray = array.slice();
                    newArray.unshift(value);
                    return newArray;
                };
                let availableSubtitleTracks = metrics.subtitleTracks.subtitleTracks || [];
                const currentSubtitleTrack = metrics.subtitleTracks.currentSubtitleTrack || "off";
                if (availableSubtitleTracks.length) {
                    // clear the list before we update/populate the metrics
                    this._uiDOMElement.playerMetrics.subtitleTracks.innerHTML = "";

                    // prepend the default selection item "off" before every other value in the list
                    // if the list's first index value is not "off"
                    if (availableSubtitleTracks[0] !== "off") {
                        availableSubtitleTracks = prepend("off", availableSubtitleTracks);
                    }
                    for (let i = 0; i < availableSubtitleTracks.length; i++) {
                        let listItem = document.createElement("li");
                        if (currentSubtitleTrack === availableSubtitleTracks[i]) {
                            listItem.setAttribute("style", "color: blue; font-weight: bold;");
                        }
                        listItem.textContent = availableSubtitleTracks[i];
                        this._uiDOMElement.playerMetrics.subtitleTracks.appendChild(listItem);
                    }
                }
            }
            if (metrics.hasOwnProperty("videoPlaybackQualities") && metrics.videoPlaybackQualities) {
                this._uiDOMElement.playerMetrics.videoDroppedFrames.textContent = metrics.videoPlaybackQualities.droppedFrames;
                this._uiDOMElement.playerMetrics.videoResolution.textContent = metrics.videoPlaybackQualities.resolution;
                this._uiDOMElement.playerMetrics.videoLatency.textContent = metrics.videoPlaybackQualities.latency !== Infinity ?
                    metrics.videoPlaybackQualities.latency : "NA";
                this._uiDOMElement.playerMetrics.videoFrameRate.textContent = metrics.videoPlaybackQualities.frameRate || "NA";
                this._uiDOMElement.playerMetrics.videoCodec.textContent = metrics.videoPlaybackQualities.codec;
                this._uiDOMElement.playerMetrics.seekStart.textContent = (metrics.videoPlaybackQualities.seekableRange !== "NA") ? metrics.videoPlaybackQualities.seekableRange.start.toFixed(2) : "NA";
                this._uiDOMElement.playerMetrics.seekEnd.textContent = (metrics.videoPlaybackQualities.seekableRange !== "NA") ? metrics.videoPlaybackQualities.seekableRange.end.toFixed(2) : "NA";
                this._uiDOMElement.playerMetrics.seekDuration.textContent = (metrics.videoPlaybackQualities.seekableRange !== "NA") ? this.secondsToString(metrics.videoPlaybackQualities.seekableRange.duration) : "NA";
            }
            if (metrics.hasOwnProperty("audioPlaybackQualities") && metrics.audioPlaybackQualities) {
                this._uiDOMElement.playerMetrics.audioCodec.textContent = metrics.audioPlaybackQualities.codec
            }
            if (metrics.hasOwnProperty("backendModulesStartupTime")) {
                this._uiDOMElement.playerMetrics.backendModulesStartupTime.textContent = metrics.backendModulesStartupTime;
            }
            if (metrics.hasOwnProperty("bitmovinLoadTime")) {
                this._uiDOMElement.playerMetrics.bitmovinLoadTime.textContent = metrics.bitmovinLoadTime;
            }
            if (metrics.hasOwnProperty("bitmovinRenderTime")) {
                this._uiDOMElement.playerMetrics.bitmovinRenderTime.textContent = metrics.bitmovinRenderTime;
            }
        }
    }

    /**
     * Translates seconds into human readable format of seconds, minutes, hours, days, and years
     *
     * @param  {number} seconds The number of seconds to be processed
     * @return {string} The phrase describing the the amount of time
     */
    secondsToString(seconds) {
        var days = Math.floor(seconds / (24 * 60 * 60));
        seconds -= days * (24 * 60 * 60);
        var hours = Math.floor(seconds / (60 * 60));
        seconds -= hours * (60 * 60);
        var minutes = Math.floor(seconds / (60));
        seconds -= minutes * (60);
        return ((0 < days) ? (days + "day, ") : "") + ((0 < hours) ? (hours + "h, ") : "") + ((0 < minutes) ? (minutes + "m and ") : "") + Math.round(seconds) + "s";
    }

    /**
     * @summary
     * Update the start and end time for the current program.
     *
     * @description
     * When called, the start and end time will be displayed over the video
     * progress bar.
     *
     * <br><br>Note: When either startTime or endTime value is "null" the entire
     * program time display is reset and hidden from display.
     *
     * @param {Date} [startTime] start time of the current program
     * @param {Date} [endTime] end time of the current program
     */
    updateProgramTime(startTime = null, endTime = null) {
        if (startTime && endTime) {
            this._uiDOMElement.player.programStartTime.textContent = startTime.toLocaleTimeString("en-US");
            this._uiDOMElement.player.programEndTime.textContent = endTime.toLocaleTimeString("en-US");
            this._uiDOMElement.player.programTimeContainer.style.opacity = 1;
            this._uiDOMElement.player.videoSlider.disabled = (startTime.getTime() === endTime.getTime());
        } else {
            // hide the elements
            this._uiDOMElement.player.programStartTime.textContent = "";
            this._uiDOMElement.player.programEndTime.textContent = "";
            this._uiDOMElement.player.programTimeContainer.style.opacity = 0;
        }
    }

    /**
     * @summary
     * Updates video progress bar with video position, buffer position and
     * current video duration.
     *
     * @description
     * Updates the video slider and the time values on the player screen to show
     * the current position and duration of video along with the current buffer
     * position as well.
     *
     * <br><br>Note: Calling this function without any values or with "0" for
     * videoPosition, bufferLevel and videoDuration will do the job of resetting
     * the video progress bar.
     *
     * @param {number} videoPosition the current video position in seconds
     * @param {number} videoDuration the current video duration in seconds
     * @param {number} [bufferLength] the current buffer length in seconds
     */
    updateVideoPosition(videoPosition = 0, videoDuration = 0, bufferLength = 0) {
        this._uiDOMElement.player.videoTimerContainer.style.display = (videoPosition || videoDuration) ? "" : "none";
        videoPosition = this.formatVideoPosition(videoPosition);
        videoDuration = this.formatVideoPosition(videoDuration);
        bufferLength = this.formatVideoPosition(bufferLength);

        let videoSliderPosition = videoDuration > 0 ? this.fixedTo((videoPosition / videoDuration) * 100, 2) : 0;
        let bufferPosition = videoDuration > 0 ? this.fixedTo(videoSliderPosition + ((bufferLength / videoDuration) * 100), 2) : 0;

        // to reset the controls, we pass 0, 0, 0 as input and these values can become NaN
        if (Number.isNaN(videoSliderPosition)) {
            videoSliderPosition = 0;
        }
        if (Number.isNaN(bufferPosition)) {
            bufferPosition = 0;
        }

        // knob position
        this.updateVideoSliderPosition(videoSliderPosition);

        // position and duration time update
        this._uiDOMElement.player.videoPosition.textContent = this.getHHMMSS(videoPosition);
        this._uiDOMElement.player.videoDuration.textContent = this.getHHMMSS(videoDuration);

        // video slider progress fill
        let colCode = this.updateSeekBarColor(this._markers, videoSliderPosition, bufferPosition);
        this._uiDOMElement.player.videoSlider.style.background = `linear-gradient(to right, ${colCode})`;
    }

    /**
     * @summary
     * Formatting possition removing DA duration
     *
     * @description
     * return asset position/duration without DA interval
     *
     * @param {number} pos asset position/duration
     *
     * @returns {number} current position without DA interval
     */
    formatVideoPosition(pos) {
        pos = this.fixedTo(pos, 2);
        let totalADduration = 0;
        let _pos = 0;
        let isChanged = false;

        if (this._markers && this._markers.actualDAStartTimeList) {
            for (let j = 0; j < this._markers.actualDAStartTimeList.length; j++) {
                if (this._markers.actualDAStartTimeList[j] <= pos &&
                    pos <= (this._markers.actualDAStartTimeList[j] + this._markers.admarkersIntervalList[j])) {
                    break;
                }
            }

            for (let i = 0; i < this._markers.actualDAStartTimeList.length; i++) {
                if (pos < this._markers.actualDAStartTimeList[i]) {
                    _pos = (pos - totalADduration) < 0 ? 0 : (pos - totalADduration);
                    isChanged = true;
                    break;
                } else if (pos >= this._markers.actualDAStartTimeList[i] &&
                    pos <= (this._markers.actualDAStartTimeList[i] + this._markers.admarkersIntervalList[i])) {
                    _pos = (pos - totalADduration) < 0 ? 0 : (this._markers.actualDAStartTimeList[i] - totalADduration);
                    isChanged = true;
                    break;
                }
                totalADduration += this._markers.admarkersIntervalList[i];
            }
        }
        return !this._markers ? pos : this.fixedTo((isChanged ? _pos : (pos - (this._markers.totalDADuration ? this._markers.totalDADuration : 0))), 2);
    }

    /**
     * @summary updateAdMarkersValue
     * @description API to render admarker in the progress bar
     * @param {*} markers
     * @param {*} duration
     * @param {*} isLive
     */
    updateAdMarkersValue(markers, duration, isLive = false) {
        let admarkerList = (markers && markers.admarkers.length) ? markers.admarkers : [];
        if (!admarkerList.length) {
            this._markers = null; // reset seekBar & time
            return;
        }
        let admarkers = {
            actualDAStartTimeList: [],
            formatedDAStartTimeList: [],
            admarkersIntervalList: [],
            adMarkerSeekbarList: [],
            totalDADuration: 0,
            actualMediaDuration: 0
        };

        admarkers.actualMediaDuration = duration; // sec
        admarkers.totalDADuration = 0;
        if (isLive) {
            const adItem = admarkerList[admarkerList.length - 1];
            admarkers.actualDAStartTimeList.push(this.fixedTo(adItem.position / 1000, 2)); //sec
            admarkers.admarkersIntervalList.push(this.fixedTo(adItem.duration / 1000, 2)); // sec
            admarkers.formatedDAStartTimeList.push(this.fixedTo((adItem.position - admarkers.totalDADuration) / 1000, 2)); // sec
            admarkers.totalDADuration = adItem.duration;
        } else {
            admarkerList.forEach((adItem) => {
                admarkers.actualDAStartTimeList.push(this.fixedTo(adItem.position / 1000, 2)); //sec
                admarkers.admarkersIntervalList.push(this.fixedTo(adItem.duration / 1000, 2)); // sec
                admarkers.formatedDAStartTimeList.push(this.fixedTo((adItem.position - admarkers.totalDADuration) / 1000, 2)); // sec
                admarkers.totalDADuration += adItem.duration;
            });
        }
        admarkers.totalDADuration = this.fixedTo(admarkers.totalDADuration / 1000, 2);

        if (!isLive) {
            admarkers.actualMediaDuration = this.fixedTo(admarkers.actualMediaDuration - admarkers.totalDADuration, 2); // sec

            admarkers.formatedDAStartTimeList.forEach((item) => {
                var pos1 = this.fixedTo((item / admarkers.actualMediaDuration) * 100, 2); // get percentage
                pos1 = pos1 >= 99 ? 99 : pos1;
                admarkers.adMarkerSeekbarList.push(pos1);
            });
        }

        this._markers = admarkers;
    }

    /**
     * @summary
     * Update SeekBar Colors
     * @description
     * Update SeekBar Colors
     * @param {array} adBlocks
     * @param {number} sBar
     * @param {number} bBar
     */
    updateSeekBarColor(adBlocks = [], sBar = 0, bBar = 0) {
        const col = {
            progressCol: '#ff4500 ',
            bufferCol: '#f89406 ',
            backgroundCol: '#d3d3d3 ',
            adMarkerCol: '#21A905 '
        };
        const markerLen = 1;
        if (adBlocks && adBlocks.adMarkerSeekbarList && adBlocks.adMarkerSeekbarList.length) {
            var colArr = this.getColorArr(adBlocks.adMarkerSeekbarList, sBar, bBar, col, markerLen);
            var colBar = ''; // create color string for linear-gradient
            for (let i = 0; i < colArr.length; i = i + 2) {
                colBar = colBar + (i >= (colArr.length - 1) ? '' : `${colArr[i + 1]} ${colArr[i]}%${colArr[i + 1]} ${colArr[i + 2]}%`);
            }
            return colBar.replace(/%#/g, '%, #');
        } else {
            return `${col.progressCol} 0%, ${col.progressCol} ${sBar}%, ${col.bufferCol} ${sBar}%, ${col.bufferCol} ${bBar}%, ${col.backgroundCol} ${bBar}%, ${col.backgroundCol} 100%`;
        }
    }

    /**
     * @summary
     * Get SeekBar Colors List
     * @description
     *
     * @param {array} markers DAI information: start time and duration
     * @param {number} pos media position
     * @param {number} buff media buffer length
     * @param {object} col  seekbar color array
     * @param {number} markerlen DAI marker length
     */
    getColorArr(markers = [], pos, buff, col = {}, markerlen) {
        var isAddColor = {
            progress: false,
            buffer: false
        };
        var cArr = [];

        buff = buff >= pos ? buff : pos;
        cArr.push(0);
        for (let i = 0; i < markers.length; i++) {
            var advt = Math.round(markers[i]);
            if (pos <= advt + markerlen && buff <= advt + markerlen) {
                if (!isAddColor.progress) {
                    pos = pos >= advt ? advt : pos;
                    isAddColor.progress = true;
                    cArr.push(col.progressCol);
                    cArr.push(pos);
                }
                if (!isAddColor.buffer) {
                    buff = buff >= advt ? advt : buff;
                    isAddColor.buffer = true;
                    cArr.push(col.bufferCol);
                    cArr.push(buff);
                }
                cArr.push(col.backgroundCol);
                cArr.push(advt);
                cArr.push(col.adMarkerCol);
                cArr.push(advt + markerlen);

            } else if (pos <= advt + markerlen && buff > advt + markerlen) {
                if (!isAddColor.progress) {
                    pos = pos >= advt ? advt : pos;
                    isAddColor.progress = true;
                    cArr.push(col.progressCol);
                    cArr.push(pos);
                }
                cArr.push(col.backgroundCol);
                cArr.push(advt);
                cArr.push(col.adMarkerCol);
                cArr.push(advt + markerlen);
            } else if (pos > advt) {
                cArr.push(col.progressCol);
                cArr.push(advt);
                cArr.push(col.adMarkerCol);
                cArr.push(advt + markerlen);
            }
            if (!isAddColor.buffer && buff < advt) {
                isAddColor.buffer = true;
                cArr.push(col.bufferCol);
                cArr.push(buff);
            }
        }
        if (cArr.indexOf(100) < 0) {
            if (!isAddColor.progress) {
                isAddColor.progress = true;
                cArr.push(col.progressCol);
                cArr.push(pos);
            }
            if (!isAddColor.buffer) {
                isAddColor.buffer = true;
                cArr.push(col.bufferCol);
                cArr.push(buff);
            }
            cArr.push(col.backgroundCol);
            cArr.push(100);
        }
        return cArr;
    }

    /**
     * @summary
     * Formatted number upto decimal places
     * @description
     * formatted number upto decimal places
     *
     * @param {number|string} num number in decimal or string format
     * @param {number} d formatting number upto the decimal places
     */
    fixedTo(num = 0, d = 0) {
        var regex = /^[\d]*[.][\d]+$|^[\d]+[.][\d]*$|^[\d]+$/g;
        if (regex.test(num)) {
            return Number(Number(num).toFixed(d));
        } else {
            console.error(`Invalid Number Format: ${num}`);
            return NaN;
        }
    }

    /**
     * @summary
     * Update the volume controls.
     *
     * @description
     * Updates the volume slider and the volume icons on the volume toggle button
     * for the given volume level.
     *
     * @param {boolean} mute indicates mute or unmute
     */
    updateVolumeControls(mute = false) {
        const volumeLevel = Number(this._uiDOMElement.player.volumeSlider.value);

        // update the icon
        if (volumeLevel === 0 || mute) {
            this._uiDOMElement.player.volumeButton.className = FAIconClassName.VolumeMute;
        } else if (volumeLevel > 0 && volumeLevel <= 0.5) {
            this._uiDOMElement.player.volumeButton.className = FAIconClassName.VolumeDown;
        } else if (volumeLevel > 0.5) {
            this._uiDOMElement.player.volumeButton.className = FAIconClassName.VolumeUp;
        }

        // volume slider progress fill
        this._uiDOMElement.player.volumeSlider.style.background = "linear-gradient(to right, rgba(255, 69, 0 , 1 ) 0%, rgba(255, 69, 0 , 1 ) " + (volumeLevel * 100) + "%,  #d3d3d3 " + (volumeLevel * 100) + "%)";
    }

    /**
     * @summary
     * Enable / Disable beacon failover inputs.
     *
     * @description
     * Enable / Disable beacon failover inputs like duration, initial and final.
     *
     */
    onToggleBeaconFailover() {
        let isBeaconFailoverEnabled = (this._uiDOMElement.config.beaconFailover && this._uiDOMElement.config.beaconFailover.checked);
        this._uiDOMElement.config.beaconFailoverDuration.disabled = !isBeaconFailoverEnabled;
        this._uiDOMElement.config.beaconFailoverInitInterval.disabled = !isBeaconFailoverEnabled;
        this._uiDOMElement.config.beaconFailoverFinalInterval.disabled = !isBeaconFailoverEnabled;
        this.onBeaconDataChange();
    }

    /**
     * @summary
     * Trigger Beacon Change Event.
     *
     * @description
     * Trigger Beacon data change event for checkbox toggle or any other data change.
     *
     */
    onBeaconDataChange() {
        let isBeaconFailoverEnabled = (this._uiDOMElement.config.beaconFailover && this._uiDOMElement.config.beaconFailover.checked);
        this.triggerEvent(WMCRefAppUIManagerEvent.BeaconDataChange, {
            beaconFailover: isBeaconFailoverEnabled,
            beaconFailoverDuration: this._uiDOMElement.config.beaconFailoverDuration.value,
            beaconFailoverInitInterval: this._uiDOMElement.config.beaconFailoverInitInterval.value,
            beaconFailoverFinalInterval: this._uiDOMElement.config.beaconFailoverFinalInterval.value
        });
    }

    /**
     * @summary
     * Enable / Disable time-shift controls.
     *
     * @description
     * Enable / Disable time-shift controls like restart, play/pause, skip back, skip forward and live now.
     *
     */
    toggleTimeShiftControlVisibility(isDisabled, programInfoAvailable) {
        isDisabled = isDisabled | false;

        this._uiDOMElement.player.restartButton.disabled = isDisabled;
        this._uiDOMElement.player.skipBackButton.disabled = isDisabled;
        this._uiDOMElement.player.playPauseButton.disabled = isDisabled;
        this._uiDOMElement.player.skipForwardButton.disabled = isDisabled;
        this._uiDOMElement.player.liveNowButton.disabled = isDisabled;
        this._uiDOMElement.player.videoSlider.disabled = isDisabled;
        this._uiDOMElement.player.videoSlider.style.cursor = isDisabled ? "auto" : "pointer";

        if (!programInfoAvailable) {
            this._uiDOMElement.player.videoTimerContainer.style.display = isDisabled ? "none" : "";
        }

        return true;
    }

    /**
     * @summary
     * Populate the list of available video qualities.
     *
     * @description
     * Populate the list of available video qualities on the player settings menu.
     *
     */
    populateVideoQualities(videoQualities) {
        if (videoQualities && videoQualities.length) {
            for (let i = 0; i < videoQualities.length; i++) {
                var quality = videoQualities[i];
                if (quality.id === 'auto') {
                    this._uiDOMElement.player.playbackQualitySelect.add(new Option(quality.label, quality.id, true, true));
                } else {
                    this._uiDOMElement.player.playbackQualitySelect.add(new Option(quality.label, quality.id));
                }
            }
            this._uiDOMElement.player.playbackQualitySelect.parentElement.style.display = "block";
        } else {
            while (this._uiDOMElement.player.playbackQualitySelect.options.length > 0) {
                this._uiDOMElement.player.playbackQualitySelect.remove(0);
            }
            this._uiDOMElement.player.playbackQualitySelect.parentElement.style.display = "none";
        }
    }

    /**
     * @summary
     * Event handler for the change event for the playback quality selection.
     *
     * @description
     * This event handler is called when there is a change in the playback
     * quality selection.
     *
     * <br><br>WMCRefAppUIManagerEvent.PlaybackQualitySelect event will be triggered
     * along with the current playback quality selected present in the event data.
     */
    onPlaybackQualitySelectChange() {
        console.log(WMCRefAppUIManager_TAG, `Playback quality changed to: ${this._uiDOMElement.player.playbackQualitySelect.selectedOptions[0].text}`);
        this.triggerEvent(WMCRefAppUIManagerEvent.PlaybackQualitySelect, {
            qualityId: this._uiDOMElement.player.playbackQualitySelect.value
        });
    }

    /**
     * @summary
     * Event handler for the change event for the cast receiver app id.
     *
     * @description
     * This event handler is called when there is a change in the cast
     * receiver app id.
     *
     */
    onCastReceiverAppIdChange() {
        let oldValue = localStorage.getItem('receiverAppID');
        let newValue = this._uiDOMElement.config.castReceiverAppId.value;
        if (newValue.trim()) {
            localStorage.setItem('receiverAppID', newValue);
            let event = new CustomEvent(WMCChromeCastSenderEvent.ReceiverAppIdChange, {
                receiverAppID: newValue
            });
            document.dispatchEvent(event);
        } else {
            this._uiDOMElement.config.castReceiverAppId.value = oldValue || DEFAULT_RECEIVER_APPID;
        }
        return true;
    }

    /**
     * @summary
     * Enable / Disable specific player controls.
     *
     * @description
     * This event enable/disable specific player control.
     *
     */
    disableEnablePlayerControls(controlType, isDisabled) {
        isDisabled = isDisabled | false;
        switch (controlType) {
            case PlayerControls.Restart:
                this._uiDOMElement.player.restartButton.disabled = isDisabled;
                break;
            case PlayerControls.SkipBack:
                this._uiDOMElement.player.skipBackButton.disabled = isDisabled;
                break;
            case PlayerControls.SkipForward:
                this._uiDOMElement.player.skipForwardButton.disabled = isDisabled;
                break;
            case PlayerControls.Play:
            case PlayerControls.Pause:
                this._uiDOMElement.player.playPauseButton.disabled = isDisabled;
                break;
            case PlayerControls.Stop:
                this._uiDOMElement.player.stopButton.disabled = isDisabled;
                break;
            case PlayerControls.Volume:
                this._uiDOMElement.player.volumeButton.disabled = isDisabled;
                break;
            case PlayerControls.ProgressBar:
                this._uiDOMElement.player.videoSlider.disabled = isDisabled;
                this._uiDOMElement.player.videoSlider.style.cursor = isDisabled ? "auto" : "pointer";
                break;
            case PlayerControls.LiveNow:
                this._uiDOMElement.player.liveNowButton.disabled = isDisabled;
                break;
        }
    }

    toggleSourceConfigOption() {
        var configFromUrl = this._uiDOMElement.config.loadSourceConfigFromUrlOption.checked;
        this._uiDOMElement.config.loadSourceConfigUrlPath.style.display = configFromUrl ? "block" : "none";
        this._uiDOMElement.config.loadSourceConfigFilePath.style.display = !configFromUrl ? "block" : "none";
    }

    /**
     * @summary
     * Event handler for the change event for the video slider position change.
     *
     * @description
     * This event handler is called when there is a change in the video slider position.
     *
     * @param {number} position indicates poistion to which the video slider has to move.
     */
    updateVideoSliderPosition(position) {
        if (position !== null && position !== undefined && position > -1) {
            this._uiDOMElement.player.videoSlider.value = position;
        }
    }

    /**
     * @summary
     * Event handler for the input event for the video slider.
     *
     * @description
     * This event handler is called when there is a input for the video slider due to
     * user interaction.
     *
     */
    updateVideoSliderColor() {
        this._uiDOMElement.player.videoSlider.style.background = "linear-gradient(to right, rgba(255, 69, 0 , 1 ) 0%, rgba(255, 69, 0 , 1 ) " +
            this._uiDOMElement.player.videoSlider.value + "%,  #d3d3d3 " + this._uiDOMElement.player.videoSlider.value + "%)";
    }

    /**
     * @summary
     * Update the player ad event logs.
     *
     * @description
     * Update the various player ad event logs on display in the UI.
     *
     * @param {any} message indicates log message
     * @param {boolean} separator flag for adding a separator
     */
    updateADEventLogs(message, separator) {
        this._uiDOMElement.adEvents.adEventContainerWrapper.style.display = "block";
        var msgStr = this._uiDOMElement.adEvents.adEventContainer.innerHTML;
        if (message && message !== "") {
            console.log(message);
            message = (typeof message == "object") ? (JSON && JSON.stringify ? JSON.stringify(message, undefined, 4) : message) : message;
            message = message.replace("%c", "");
            var type = message.split(",")[0].split("type:")[1];
            message = message.replace(type, `<span style="color: red;">${type}</span>`);
            msgStr = `${separator ? '<hr/>' : ''} ${new Date().toISOString().split('T')[1]}&nbsp;&nbsp;<span style="color: blue;">${message}</span><br/>${msgStr}`;
            this._uiDOMElement.adEvents.adEventContainer.innerHTML = msgStr;
            this._uiDOMElement.adEvents.adEventContainer.scrollTop = `${this._uiDOMElement.adEvents.adEventContainer.scrollHeight}px`;
        }
    }

    /* Class constructor */
    constructor() {
        this._eventListeners = [];
        this._sourceList = {};
        /* DAI markers list */
        this._markers = null;
        this._uiDOMElement = {
            player: {
                playerHeaderContainer: document.getElementById("app-name-version"),
                playerContainer: document.getElementById("player-container"),
                videoElement: document.getElementById("video-element"),
                audioElement: document.getElementById("audio-element"),
                contentPoster: document.getElementById("content-poster"),
                posterImage: document.getElementById("poster-image"),
                subtitleContainer: document.getElementById("subtitle-container"),
                spinner: document.getElementById("spinner"),
                settingsMenu: document.getElementById("settings-menu"),
                toastMessage: document.getElementById("toast-message"),
                errorMessageContainer: document.getElementById("error-message-container"),
                advertisementSkip: document.getElementById("video-advertisement"),
                showAd: document.getElementById("show-ads"),
                skipAd: document.getElementById("skip-ads"),
                errorCode: document.getElementById("error-code"),
                errorMessage: document.getElementById("error-message"),
                videoControls: document.getElementById("video-controls"),
                programTimeContainer: document.getElementById("program-time-container"),
                programStartTime: document.getElementById("program-start-time"),
                programEndTime: document.getElementById("program-end-time"),
                videoProgress: document.getElementById("video-progress"),
                videoSlider: document.getElementById("video-slider"),
                restartButton: document.getElementById("restart-btn"),
                skipBackButton: document.getElementById("skip-back-btn"),
                playPauseButton: document.getElementById("play-pause-btn"),
                stopButton: document.getElementById("stop-btn"),
                skipForwardButton: document.getElementById("skip-forward-btn"),
                liveNowButton: document.getElementById("live-btn"),
                volumeButton: document.getElementById("volume-btn"),
                settingsButton: document.getElementById("settings-btn"),
                fullscreenButton: document.getElementById("fullscreen-btn"),
                ccToggle: document.getElementById("cc-toggle"),
                subtitleTrackSelect: document.getElementById("subtitle-track-select"),
                audioTrackSelect: document.getElementById("audio-track-select"),
                playbackQualitySelect: document.getElementById("playback-quality-select"),
                playbackSpeedSelect: document.getElementById("playback-speed-select"),
                logLevelSelect: document.getElementById("log-level-select"),
                volumeProgress: document.getElementById("volume-progress"),
                volumeSlider: document.getElementById("volume-slider"),
                videoPosition: document.getElementById("video-position"),
                videoDuration: document.getElementById("video-duration"),
                videoTimerContainer: document.getElementById("video-time-update"),
                googleCastButton: document.getElementsByTagName("google-cast-launcher")
            },
            config: {
                serverUrl: document.getElementById("server-request-url"),
                ownerUid: document.getElementById("owner-uid"),
                primaryAccount: document.getElementById("primary-account"),
                tenantId: document.getElementById("tenant-id"),
                mediaUid: document.getElementById("media-uid"),
                appToken: document.getElementById("app-token"),
                playbackMode: document.getElementById("playback-mode"),
                stsToken: document.getElementById("sts-token"),
                catchupStartTime: document.getElementById("catchup-start-time"),
                externalSourceUrl: document.getElementById("external-source-url"),
                externalSourceLicenseUrl: document.getElementById("external-source-license-url"),
                bookmarkEnabled: document.getElementById("bookmark-checkbox"),
                analyticsEnabled: document.getElementById("analytics-checkbox"),
                lowLatencyEnabled: document.getElementById("llc-checkbox"),
                contentAdvisoryEnabled: document.getElementById("ca-checkbox"),
                newServerEnabled: document.getElementById("new-server-checkbox"),
                metricsEnabled: document.getElementById("metric-enable-checkbox"),
                maxVideoBitrate: document.getElementById("max-video-bitrate"),
                minVideoBitrate: document.getElementById("min-video-bitrate"),
                startingVideoBitrate: document.getElementById("starting-video-bitrate"),
                inhomeServerUrl: document.getElementById("inhome-server-url"),
                inhomeServerToken: document.getElementById("inhome-server-token"),
                defaultInhomeStatus: document.getElementById("default-inhome-server-status-select"),
                setInhomeStatus: document.getElementById("set-inhome-server-status-select"),
                getInhomeStatusButton: document.getElementById("get-inhome-server-status-btn"),
                setInhomeStatusButton: document.getElementById("set-inhome-server-status-btn"),
                cdnProfile: document.getElementById("cdn-profile"),
                cdnUrl: document.getElementById("cdn-url"),
                transcodeFormat: document.getElementById("transcode-format"),
                encDrmSeed: document.getElementById("enc-drm-seed"),
                manifestRetryCount: document.getElementById("manifest-retry-count"),
                manifestRetryInterval: document.getElementById("manifest-retry-interval"),
                cdnFailoverPercentage: document.getElementById("cdn-failover-percentage"),
                loadSourceConfigPath: document.getElementById("load-source-config-path"),
                loadExternalSourceButton: document.getElementById("load-external-source-btn"),
                loadSourceConfigFromUrlOption: document.getElementById("load-config-url-radio"),
                loadSourceConfigFromFileOption: document.getElementById("load-config-file-radio"),
                loadSourceConfigButton: document.getElementById("load-source-config-btn"),
                loadSourceConfigFilePath: document.getElementById("load-source-config-file-path"),
                loadSourceConfigUrlPath: document.getElementById("load-config-file-url"),
                beaconFailover: document.getElementById("beacon-failover"),
                beaconFailoverDuration: document.getElementById("failover-duration"),
                beaconFailoverInitInterval: document.getElementById("failover-initial"),
                beaconFailoverFinalInterval: document.getElementById("failover-final"),
                castReceiverAppId: document.getElementById("receiver-app-id-input"),
                isDVR: document.getElementById("isDVR-checkbox"),
                forwardBuffer: document.getElementById("forward-buffer"),
                backwardBuffer: document.getElementById("backward-buffer"),
                cdnToken: document.getElementById("cdn-token"),
                cdnFailoverPercentageValue: document.getElementById("cdn-failover-percentage-value"),
                setOffset: document.getElementById("start-offset-value"),
                timelineReferencePoint: document.getElementById("timeline-reference-point-select"),
                startupThreshold: document.getElementById('startup-threshold-value'),
                restartThreshold: document.getElementById('restart-threshold-value'),
                bitmovinPlayerKey: document.getElementById('bitmovin-player-key'),
                bitmovinAnalyticsKey: document.getElementById('bitmovin-analytics-key'),
                chromecastVersion: document.getElementById('chromecast-version')
            },
            sourceList: {
                list: document.getElementById("source-list-accordion"),
                retailMainContainer: document.getElementById("retailContainer")
            },
            playerMetrics: {
                playerState: document.getElementById("player-state"),
                startupTime: document.getElementById("startup-time"),
                playbackSpeed: document.getElementById("playback-speed"),
                closedCaptionsState: document.getElementById("closed-captions-state"),
                videoQualities: document.getElementById("video-qualities"),
                audioTracks: document.getElementById("audio-tracks"),
                subtitleTracks: document.getElementById("subtitle-tracks"),
                videoDroppedFrames: document.getElementById("video-dropped-frames"),
                videoLatency: document.getElementById("video-latency"),
                videoBufferLength: document.getElementById("video-buffer-length"),
                audioBufferLength: document.getElementById("audio-buffer-length"),
                videoFrameRate: document.getElementById("video-framerate"),
                videoResolution: document.getElementById("video-resolution"),
                videoCodec: document.getElementById("video-codec"),
                audioCodec: document.getElementById("audio-codec"),
                seekStart: document.getElementById("seek-start"),
                seekEnd: document.getElementById("seek-end"),
                seekDuration: document.getElementById("seek-duration"),
                backendModulesStartupTime: document.getElementById("backend-modules"),
                bitmovinLoadTime: document.getElementById("bitmovin-load"),
                bitmovinRenderTime: document.getElementById("bitmovin-render"),
            },
            adEvents: {
                adEventContainerWrapper: document.getElementById("ad-events-container"),
                adEventContainer: document.getElementById("ad-events")
            },
            others: {
                closeButton: document.getElementById("close-btn")
            }
        };

        /* restore the config from the url hash and enable the change listeners for config saver */
        configSaver.restoreConfig();
        configSaver.addChangeListeners();

        /* register necessary event handlers */
        this._uiDOMElement.player.playerContainer.addEventListener("mouseenter", this.onPlayerContainerMouseEnter.bind(this));
        this._uiDOMElement.player.playerContainer.addEventListener("mouseleave", this.onPlayerContainerMouseExit.bind(this));
        this._uiDOMElement.player.videoSlider.addEventListener("input", this.onVideoSliderInput.bind(this));
        this._uiDOMElement.player.videoSlider.addEventListener("change", this.onVideoSliderChange.bind(this));
        this._uiDOMElement.player.restartButton.addEventListener("click", this.onRestartButtonClick.bind(this));
        this._uiDOMElement.player.skipBackButton.addEventListener("click", this.onSkipBackButtonClick.bind(this));
        this._uiDOMElement.player.playPauseButton.addEventListener("click", this.onPlayPauseButtonClick.bind(this));
        this._uiDOMElement.player.stopButton.addEventListener("click", this.onStopButtonClick.bind(this));
        this._uiDOMElement.player.skipForwardButton.addEventListener("click", this.onSkipForwardButtonClick.bind(this));
        this._uiDOMElement.player.liveNowButton.addEventListener("click", this.onLiveNowButtonClick.bind(this));
        this._uiDOMElement.player.volumeButton.addEventListener("click", this.onVolumeButtonClick.bind(this));
        this._uiDOMElement.player.volumeSlider.addEventListener("input", this.onVolumeSliderInput.bind(this));
        this._uiDOMElement.player.volumeSlider.addEventListener("change", this.onVolumeSliderChange.bind(this));
        this._uiDOMElement.player.settingsButton.addEventListener("click", this.onSettingsButtonClick.bind(this));
        this._uiDOMElement.player.ccToggle.addEventListener("change", this.onCCToggle.bind(this));
        this._uiDOMElement.player.subtitleTrackSelect.addEventListener("change", this.onSubtitleTrackSelectChange.bind(this));
        this._uiDOMElement.player.audioTrackSelect.addEventListener("change", this.onAudioTrackSelectChange.bind(this));
        this._uiDOMElement.player.playbackSpeedSelect.addEventListener("change", this.onPlaybackSpeedSelectChange.bind(this));
        this._uiDOMElement.player.playbackQualitySelect.addEventListener("change", this.onPlaybackQualitySelectChange.bind(this));
        this._uiDOMElement.player.logLevelSelect.addEventListener("change", this.onLogLevelSelectChange.bind(this));
        this._uiDOMElement.player.fullscreenButton.addEventListener("click", this.onFullscreenButtonClick.bind(this));

        if (this._uiDOMElement.player.skipAd) {
            this._uiDOMElement.player.skipAd.addEventListener("click", this.onSkipAdButtonClick.bind(this));
        }

        document.addEventListener('fullscreenchange', this.onFullscreenChange.bind(this));
        document.addEventListener('mozfullscreenchange', this.onFullscreenChange.bind(this));
        document.addEventListener('MSFullscreenChange', this.onFullscreenChange.bind(this));
        document.addEventListener('webkitfullscreenchange', this.onFullscreenChange.bind(this));
        if (this._uiDOMElement.config.getInhomeStatusButton) {
            this._uiDOMElement.config.getInhomeStatusButton.addEventListener("click", this.onGetInhomeStatusButtonClick.bind(this));
        }
        if (this._uiDOMElement.config.setInhomeStatusButton) {
            this._uiDOMElement.config.setInhomeStatusButton.addEventListener("click", this.onSetInhomeStatusButtonClick.bind(this));
        }
        this._uiDOMElement.config.loadExternalSourceButton.addEventListener("click", this.onLoadExternalSourceButtonClick.bind(this));
        this._uiDOMElement.config.loadSourceConfigButton.addEventListener("click", this.onLoadSourceConfigButtonClick.bind(this));
        if (this._uiDOMElement.config.loadSourceConfigFilePath) {
            this._uiDOMElement.config.loadSourceConfigFilePath.addEventListener("change", this.onLoadSourceConfigFilePathChange.bind(this));
        }
        if (this._uiDOMElement.config.beaconFailover) {
            this._uiDOMElement.config.beaconFailover.addEventListener("change", this.onToggleBeaconFailover.bind(this));
        }
        if (this._uiDOMElement.config.beaconFailoverDuration) {
            this._uiDOMElement.config.beaconFailoverDuration.addEventListener("change", this.onBeaconDataChange.bind(this));
        }
        if (this._uiDOMElement.config.beaconFailoverInitInterval) {
            this._uiDOMElement.config.beaconFailoverInitInterval.addEventListener("change", this.onBeaconDataChange.bind(this));
        }
        if (this._uiDOMElement.config.beaconFailoverFinalInterval) {
            this._uiDOMElement.config.beaconFailoverFinalInterval.addEventListener("change", this.onBeaconDataChange.bind(this));
        }

        if (this._uiDOMElement.config.castReceiverAppId) {
            this._uiDOMElement.config.castReceiverAppId.addEventListener("change", this.onCastReceiverAppIdChange.bind(this));
        }

        if (this._uiDOMElement.config.playbackMode) {
            if (this._uiDOMElement.config.playbackMode.value.toLowerCase() === "live") {
                this._uiDOMElement.config.isDVR.disabled = true;
                this._uiDOMElement.config.isDVR.checked = false;
            } else {
                this._uiDOMElement.config.isDVR.disabled = false;
            }
            this._uiDOMElement.config.playbackMode.addEventListener("change", () => {
                if (this._uiDOMElement.config.playbackMode.value.toLowerCase() === "live") {
                    this._uiDOMElement.config.isDVR.disabled = true;
                    this._uiDOMElement.config.isDVR.checked = false;
                } else {
                    this._uiDOMElement.config.isDVR.disabled = false;
                }
            });
        }

        if (this._uiDOMElement.config.targetLatency) {
            var targetLatencyValue = this._uiDOMElement.config.targetLatency.value;
            this._uiDOMElement.config.targetLatencyLabel.innerHTML = `Target Latency: ${targetLatencyValue}s`;
            this._uiDOMElement.config.targetLatency.addEventListener("input", () => {
                var targetLatencyValue = this._uiDOMElement.config.targetLatency.value;
                this._uiDOMElement.config.targetLatencyLabel.innerHTML = `Target Latency: ${targetLatencyValue}s`;
            });
            this._uiDOMElement.config.targetLatency.addEventListener("change", () => {
                var targetLatencyValue = this._uiDOMElement.config.targetLatency.value;
                this.triggerEvent(WMCRefAppUIManagerEvent.TargetLatencyChange, {
                    targetLatency: targetLatencyValue,
                });
            });
        }

        if (this._uiDOMElement.config.cdnFailoverPercentage) {
            this._uiDOMElement.config.cdnFailoverPercentage.addEventListener("input", () => {
                this._uiDOMElement.config.cdnFailoverPercentageValue.innerHTML = this._uiDOMElement.config.cdnFailoverPercentage.value;
            });
        }

        /* Update Chromecast cast app id */
        let receiverAppID = localStorage.getItem('receiverAppID') ? localStorage.getItem('receiverAppID') : DEFAULT_RECEIVER_APPID;
        if (this._uiDOMElement.config.castReceiverAppId) {
            this._uiDOMElement.config.castReceiverAppId.value = receiverAppID;
        }

        /* Show/hide load source config option */
        this.toggleSourceConfigOption();
        if (this._uiDOMElement.config.loadSourceConfigFromUrlOption) {
            this._uiDOMElement.config.loadSourceConfigFromUrlOption.addEventListener("change", this.toggleSourceConfigOption.bind(this));
        }
        if (this._uiDOMElement.config.loadSourceConfigFromFileOption) {
            this._uiDOMElement.config.loadSourceConfigFromFileOption.addEventListener("change", this.toggleSourceConfigOption.bind(this));
        }

        /* populate the source list if a valid source list config exists in the default location */
        let sourceListConfig = "resources/config/source_list_external.json"; // default file
        if (window && window.location && window.location.pathname) {
            // if it's the main page the use the main source list, else stick to default source list with external sources
            if (window.location.pathname.split("/").pop() === "" || window.location.pathname.split("/").pop() === "index.html" || window.location.pathname.split("/").pop() === "index_d.html" || window.location.pathname.split("/").pop() === "index_new.html" || window.location.pathname.split("/").pop() === "index_new_d.html") {
                sourceListConfig = "resources/config/source_list.json";
            }

            // get the full url to the source config file
            if (window.location.pathname.split("/").pop() === "") {
                sourceListConfig = window.location.href.split("#")[0] + sourceListConfig;
            } else {
                let replace_str = window.location.pathname.split("/").pop();
                sourceListConfig = window.location.href.split("#")[0].replace(replace_str, sourceListConfig);
            }

            // populate the source list and update the form input with the path as well
            if (this._uiDOMElement.config.loadSourceConfigPath) {
                sourceListConfig = this._uiDOMElement.config.loadSourceConfigPath.value ? this._uiDOMElement.config.loadSourceConfigPath.value : sourceListConfig;
                this._uiDOMElement.config.loadSourceConfigPath.value = sourceListConfig;
            }
            this.populateSourceListItemsFromConfig(sourceListConfig);
        }

        /* Close errorMessageContainer Popup Model */
        if (this._uiDOMElement.others.closeButton) {
            this._uiDOMElement.others.closeButton.addEventListener("click", this.onCloseButtonClick.bind(this));
        }

        /* initialize the player elements by resetting the controls */
        this.resetControls();
    }
}

/**
 * @typedef {object} PlayerConfig object containing the various player configuration parameters
 * @property {string} PlayerConfig.serverUrl ACC Request URL or the server hostname
 * @property {string} PlayerConfig.ownerUid owner unique identified (usually "azuki")
 * @property {string} PlayerConfig.primaryAccount the primary user account
 * @property {string} PlayerConfig.tenantId tenantId associated to the primary account (usually "default")
 * @property {string} PlayerConfig.mediaUid unique media identifier (unique for every asset)
 * @property {number} PlayerConfig.appToken application specific token (applies only to Live and DVR)
 * @property {string} PlayerConfig.playbackMode specified whether the current playback is for Live or VoD
 * @property {string} PlayerConfig.stsToken the authentication token
 * @property {string} PlayerConfig.catchupStartTime start time of the catchup asset
 * @property {string} PlayerConfig.externalSourceUrl the external source url
 * @property {boolean} PlayerConfig.bookmarkEnabled when true, bookmark feature is enabled
 * @property {boolean} PlayerConfig.analyticsEnabled when true, analytics enabled
 * @property {boolean} PlayerConfig.lowLatencyEnabled when true, low latency feature is enabled
 * @property {boolean} PlayerConfig.contentAdvisoryEnabled when true, content advisory feature is enabled
 * @property {boolean} PlayerConfig.newServerEnabled when true, new server feature is enabled
 * @property {boolean} PlayerConfig.metricsEnabled when true, access to playback metric feature is enabled
 * @property {number} PlayerConfig.maxVideoBitrate maximum allowed video bitrate for ABR
 * @property {number} PlayerConfig.minVideoBitrate minimum allowed video bitrate for ABR
 * @property {number} PlayerConfig.startingVideoBitrate the starting video bitrate to start playback with
 * @property {string} PlayerConfig.inhomeServerUrl in-home server url
 * @property {string} PlayerConfig.inhomeServerEndpoint in-home server endpoint
 * @property {string} PlayerConfig.inhomeServerToken in-home server token
 * @property {string} PlayerConfig.defaultInhomeStatus default in-home server status
 * @property {string} PlayerConfig.setInhomeStatus in-home server status
 * @property {string} PlayerConfig.cdnProfile cdn profile
 * @property {string} PlayerConfig.cdnUrl cdn url
 * @property {string} PlayerConfig.transcodeFormat transcode format
 * @property {string} PlayerConfig.encDrmSeed encryption drm seed
 * @property {string} PlayerConfig.manifestRetryCount manifest retry count
 * @property {string} PlayerConfig.manifestRetryInterval manifest retry interval
 * @property {string} PlayerConfig.beaconFailover beacon failover enabled/disabled
 * @property {string} PlayerConfig.beaconFailoverDuration beacon failover duration
 * @property {string} PlayerConfig.beaconFailoverInitInterval beacon failover initial
 * @property {string} PlayerConfig.beaconFailoverFinalInterval beacon failover final
 * @property {string} PlayerConfig.cdnFailoverPercentage CDN failover percentage
 * @property {string} PlayerConfig.isDVR when true, VOD asset will be treated as DVR
 * @property {string} PlayerConfig.forwardBuffer forward buffer value for player
 * @property {string} PlayerConfig.backwardBuffer backward buffer value for player
 * @property {string} PlayerConfig.cdnToken CDN token value for player
 * @property {string} PlayerConfig.setOffset Start offset value for player
 * @property {string} PlayerConfig.timelineReferencePoint Time line reference point for player
 * @property {string} PlayerConfig.chromecastVersion Chromecast version for player
 * @property {string} PlayerConfig.castReceiverAppId Chromecast APP ID
 */
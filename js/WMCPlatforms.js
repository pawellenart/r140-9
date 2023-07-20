"use strict";
const RequestType = {
    post: "POST",
    get: "GET",
    put: "PUT",
    del: "DELETE"
}
Object.freeze(RequestType);

/**
 * @class
 * Request
 *
 * @summary
 * Platform XMLHttpRequest Wrapper Class.
 *
 * @description
 * Every rest api calls for Platform tab is controlled by this class.
 */
class Request {
    /**
     * Request constructor
     * @ignore
     * @constructor Request
     * @param {string} method
     * @param {string} url
     * @param {Object} [params={}, headers={}, body=null, options={}]
     */
    constructor(method, url, { params = {}, headers = {}, body = null, options = {} } = {}) {
        this.TAG = "PlatformRequest";
        this.method = method;
        this.url = url;
        this.params = params;
        this.headers = headers;
        this.body = body;
        this.options = options;
        this.retries = options.retries || 0;
        this.retryInterval = options.retryInterval || 1000; // ms: milliseconds
        this.responseTime = new Date().getTime();
        this.timeout = options.timeout ? options.timeout : 10000; // ms: milliseconds

        // Create a new instance of xhr request
        this.xhr = options.xhr || null;

        if (!this.xhr) {
            if (options.cors || options.useXDR) {
                this.xhr = new XDomainRequest();
            } else {
                this.xhr = new XMLHttpRequest();
            }
        }

        if (options.responseType) {
            this.xhr.responseType = options.responseType;
        }

        if (this.timeout) {
            this.xhr.timeout = this.timeout;
        }

        if (options.withCredentials !== undefined) {
            this.xhr.withCredentials = options.withCredentials;
        }

        if (typeof this.params === "object") {
            this.queryString = Object.keys(this.params).map(key => {
                return `${key}=${encodeURIComponent(this.params[key])}`;
            }).join('&');
        } else {
            this.queryString = this.params;
        }

        this.fullUrl = this.url + (this.queryString ? "?" + this.queryString : "");
    }

    /**
     * abort - A prototype function. Handles abort.
     * used to tear down the http request if it's still outstanding
     * @memberof Request
    */
    abort() {
        this.xhr.abort();
    }

    /**
     * send - use to send http request
     * @memberof Request
     */
    send() {
        //console.log(`[${this.TAG}][Request] method: ${this.method}, url: ${this.fullUrl}, headers: ${JSON.stringify(this.headers)}, body: ${this.body}, options: ${JSON.stringify(this.options)}`);
        var that = this;
        this.xhr.open(this.method, this.fullUrl, true); //async

        // For Chrome, the browser will not cache http get request by default.
        // Only IE and Edge has msCaching property.
        // For IE and Edge, we use msCaching property to disable http get request cache.
        if (!!this.options.disableCache && this.xhr.msCaching) {
            this.xhr.msCaching = 'disabled';
        }

        Object.keys(this.headers).map(key => {
            this.xhr.setRequestHeader(key, this.headers[key]);
        });

        return new Promise(function (resolve, reject) {
            that.responseBody = function (xhr) {
                // Chrome with requestType=blob throws errors around when even testing access to responseText
                if (xhr.response) {
                    return xhr.response;
                } else {
                    return xhr.responseText || that.getXml(xhr);
                }
            };

            that.getXml = function (xhr) {
                // xhr.responseXML will throw Exception "InvalidStateError" or "DOMException"
                // See https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseXML.
                try {
                    if (xhr.responseType === "document") {
                        return xhr.responseXML;
                    }
                    var firefoxBugTakenEffect = xhr.responseXML && xhr.responseXML.documentElement.nodeName === "parsererror";
                    if (xhr.responseType === "" && !firefoxBugTakenEffect) {
                        return xhr.responseXML;
                    }
                } catch (e) { }
                return null;
            };

            that.parseHttpHeader = function (headers) {
                var result = {};
                if (headers.trim() !== "") {
                    var headersArr = headers.replace(/^\s+|\s+$/g, '').split('\n');
                    for (var i = 0; i < headersArr.length; i++) {
                        var row = headersArr[i];
                        var index = row.indexOf(':'), key = row.slice(0, index).replace(/^\s+|\s+$/g, '').toLowerCase(), value = row.slice(index + 1).replace(/^\s+|\s+$/g, ''); // jscs:disable disallowMultipleVarDecl
                        if (typeof (result[key]) === 'undefined') {
                            result[key] = value;
                        } else if (Object.prototype.toString.call(result[key]) === '[object Array]') {
                            result[key].push(value);
                        } else {
                            result[key] = [result[key], value];
                        }
                    }
                }
                return headers;
            };

            that.responseHeader = function (xhr) {
                if (xhr && xhr.getAllResponseHeaders) {
                    try {
                        return JSON.parse(that.xhr.responseText).headers;
                    } catch (e) { }
                    return this.parseHttpHeader(xhr.getAllResponseHeaders());
                }
                return {};
            };

            that.response = function (xhr, status) {
                var response = {
                    status: status,
                    statusCode: that.xhr.status,
                    body: that.responseBody(xhr),
                    headers: that.responseHeader(xhr),
                    method: that.method,
                    url: that.fullUrl,
                    responseTime: (new Date().getTime() - that.responseTime) / 1000,
                    rawRequest: that.xhr,
                    statusText: that.xhr.statusText
                };
                //console.log(`[${this.TAG}][Response] method: ${this.method}, url: ${this.fullUrl}, data: ${JSON.stringify(response)}`);
                return response;
            };

            that.retry = function (xhr, error) {
                if (that.retries !== 0) {
                    that.retries--;
                    setTimeout(() => {
                        this.xhr.open(this.method, this.fullUrl, true); //async
                        that.xhr.send(that.body);
                    }, that.retryInterval);
                } else {
                    reject(that.response(that.xhr, error));
                }
            };

            that.xhr.onload = function () {
                // 'load' triggers for 404s etc, so check the status
                if (that.xhr.status === 200) {
                    // Resolve the promise with the response text
                    resolve(that.response(that.xhr, 'success'));
                } else {
                    that.retry(that.xhr, 'success');
                }
            };

            // Handle network errors
            that.xhr.onerror = function () {
                that.retry(that.xhr, 'error');
            };

            // Handle network timeout errors
            that.xhr.ontimeout = function () {
                that.retry(that.xhr, 'timeout');
            };

            that.xhr.onreadystatechange = function () {
                /*
                    XMLHttpRequest.UNSENT -> Client has been created. open() not called yet.
                    XMLHttpRequest.OPENED -> open() has been called.
                    XMLHttpRequest.HEADERS_RECEIVED -> send() has been called and headers and status are available.
                    XMLHttpRequest.LOADING -> Downloading; responseText holds partial data.
                    XMLHttpRequest.DONE -> The operation is complete.
                */
            };

            that.xhr.send(that.body || null);
        });
    }
}

/**
 * @class
 * PlatformRefAppUIManager
 *
 * @summary
 * Platforn RefApp's UI manager.
 *
 * @description
 * Everything in the RefApp UI Platform tab is controlled and managed by this class.
 */
class PlatformRefAppUIManager {

    /**
     * @summary
     * Show logs and error messages.
     *
     * @description
     * This function is used to show logs and error messages.
     *
     */
    _showLogs(options = {}) {
        let code, message, type;
        if (options) {
            code = options.code ?? options.code;
            message = options.message ?? options.message;
            type = options.type ? options.type : 'basic';
        }
        RefAppUIMgr.showConsoleInfo({
            TAG: PlatformRefAppUIManager_TAG,
            code,
            message,
            type
        });

        if (options.type === 'error' || (code >= 400 && code <= 510)) {
            if (code === 0) {
                code = 102;
                message = 'A network error occurred. '
                    + 'This could be a CORS issue or a dropped internet connection.';
            }
            message = message ? message : "Unknown Error";
            RefAppUIMgr.showErrorMessage(code, message);
            console.log(code, message);
        }
    }

    // Rest call response parsear 
    _responseParser(data) {
        let res = null;
        if (data) {
            try {
                res = JSON.parse(data.body);
            } catch (e) {
                data.statusText = `Unable to parse http response, data: ${String(data.body)}`;
                return new Exception(data);
            }
        }

        if (!res) {
            data = data ? data : {};
            data.statusText = `Invalid response from server, data: ${String(data && data.body ? data.body : data)}`;
            return new Exception(data);
        }
        return res;
    }

    // Rest call error parser 
    _errorParser(data) {
        this._showLogs({
            code: data.statusCode,
            message: data.body,
            type: 'error'
        });
        return;
    }

    // Format a URL
    _parseUri(uri) {
        if (uri.length > 0 && uri.charAt(uri.length - 1) === "/") {
            return uri.substring(0, uri.length - 1);
        }
        return uri;
    }

    // Send REST call
    _sendRequest(request) {
        const reachRequest = new Request(request.method, request.url, request.others);
        return reachRequest.send()
            .catch((error) => {
                return Promise.reject(this._errorParser(error));
            })
            .then((result) => {
                return Promise.resolve(this._responseParser(result));
            });
    }

    // Show hide spinner
    _spinner(show) {
        if (show) {
            this._platformUIDOMElement.platformSourceList.loadingSpinner.classList.add("d-flex");
            this._platformUIDOMElement.platformSourceList.loadingSpinner.style.display = "block";
            this._platformUIDOMElement.platformSourceList.initialText.querySelector("h5").innerHTML = "Loading event list, please wait ...";
        } else {
            this._platformUIDOMElement.platformSourceList.loadingSpinner.classList.remove("d-flex");
            this._platformUIDOMElement.platformSourceList.loadingSpinner.style.display = "none";
            this._platformUIDOMElement.platformSourceList.initialText.querySelector("h5").innerHTML = this.withoutLogin ? "Select environment load event list" : "Login to load event list";
        }
    }

    // Show an element
    _show(elem) {

        // Get the natural height of the element
        var getHeight = function () {
            elem.style.display = 'block'; // Make it visible
            var height = elem.scrollHeight + 'px'; // Get it's height
            elem.style.display = ''; //  Hide it again
            return height;
        };

        var height = getHeight(); // Get the natural height
        elem.classList.add('is-visible'); // Make the element visible
        elem.style.height = height; // Update the max-height

        // Once the transition is complete, remove the inline max-height so the content can scale responsively
        window.setTimeout(function () {
            elem.style.height = '';
        }, 350);

    };

    // Hide an element
    _hide(elem) {

        // Give the element a height to change from
        elem.style.height = elem.scrollHeight + 'px';

        // Set the height back to 0
        window.setTimeout(function () {
            elem.style.height = '0';
        }, 1);

        // When the transition is complete, hide it
        window.setTimeout(function () {
            elem.classList.remove('is-visible');
        }, 350);

    };

    // Toggle element visibility
    _toggle(elem, timing) {

        if (elem.classList.contains('is-visible')) {
            this._hide(elem);
            return false;
        }

        // Otherwise, show it
        this._show(elem);
        return true;
    };

    // Set request urls based on env selection
    setRequestUrls() {
        const defaultEnv = this._platformUIDOMElement.login.environmentDropdown.options[this._platformUIDOMElement.login.environmentDropdown.selectedIndex];

        if (defaultEnv) {
            requestURLs = allConfig[defaultEnv.value];
            if (requestURLs) {
                this.withoutPlatformLogin(requestURLs.stsToken);
            }
        }
    }

    /**
     * @summary
     * Event handler for Platform login button click.
     *
     * @description
     * This event handler is called when Platform login button is clicked.
     *
     */
    onPlatformLogin() {
        RefAppUIMgr.clearErrorMessage();
        if (!this._platformUIDOMElement.login.username.value.trim() || !this._platformUIDOMElement.login.password.value.trim()) {
            this._showLogs({
                code: "Login",
                message: "Invalid login parameters!",
                type: 'error'
            });
            return;
        }

        const eventsListContainer = this._platformUIDOMElement.platformSourceList.eventsListContainer;
        if (eventsListContainer.querySelector('.accordion-body').querySelector('.source-list')) {
            eventsListContainer.lastChild.innerHTML = "";
            const eventAccordionContainer = new DOMParser().parseFromString(
                `<div class="accordion-body">
                    <div class="row event-list">
                        <div id="loading-spinner" class="justify-content-center">
                            <div class="spinner-border" role="status">
                            <span class="visually-hidden">Loading...</span>
                            </div>
                        </div>
                        <div id="initial-text">
                            <h5></h5>
                        </div>
                    </div>
                </div>`,
                "text/html").body.firstChild;

            if (eventAccordionContainer) {
                eventsListContainer.innerHTML = "";
                eventsListContainer.appendChild(eventAccordionContainer);
                this._platformUIDOMElement.platformSourceList.initialText = document.getElementById("initial-text");
            }
        }

        configDataSource = {
            serverUrl: "",
            ownerUid: "",
            mediaUid: "",
            playbackMode: "",
            appToken: "",
            primaryAccount: "",
            newServer: true,
            analytics: true,
            stsToken: "",
            forwardBuffer: null,
            backwardBuffer: null
        }

        this._spinner(true);

        const data = {
            "email": this._platformUIDOMElement.login.username.value.trim(),
            "password": this._platformUIDOMElement.login.password.value.trim(),
            "rememberMe": false
        }

        const requestParam = {
            method: RequestType.post,
            url: requestURLs.authUrl,
            others: {
                body: (data) ? JSON.stringify(data) : JSON.stringify({})
            }
        }

        this._sendRequest(requestParam)
            .then((res) => {
                if (res && res.data && res.data.jwt) {
                    this.getSTSToken(res.data.jwt);
                }
            }).catch((e) => {
                this._spinner(false);
            });
        return;
    }

    getSTSToken(jwtToken) {
        if (!jwtToken) {
            this._showLogs({
                code: "Get STS Token",
                message: "Invalid JWT token!",
                type: 'error'
            });
            return;
        }

        const data = {
            jwtTokenRequest: jwtToken
        }

        const requestParam = {
            method: RequestType.get,
            url: requestURLs.stsTokenUrl,
            others: {
                params: data
            }
        }
        this._sendRequest(requestParam)
            .then((res) => {
                if (res.AccessToken) {
                    configDataSource.stsToken = res.AccessToken;
                    this.getRightsGroup(configDataSource.stsToken);
                }
            }).catch((e) => {
                this._spinner(false);
            });
        return;
    }

    withoutPlatformLogin(stsToken) {
        RefAppUIMgr.clearErrorMessage();
        const eventsListContainer = this._platformUIDOMElement.platformSourceList.eventsListContainer;
        this._platformUIDOMElement.platformSourceList.eventsListContainer.parentElement.querySelector('.accordion-button').innerHTML = `Events`;
        if (eventsListContainer.querySelector('.accordion-body').querySelector('.source-list')) {
            eventsListContainer.lastChild.innerHTML = "";
            const eventAccordionContainer = new DOMParser().parseFromString(
                `<div class="accordion-body">
                    <div class="row event-list">
                        <div id="loading-spinner" class="justify-content-center">
                            <div class="spinner-border" role="status">
                            <span class="visually-hidden">Loading...</span>
                            </div>
                        </div>
                        <div id="initial-text">
                            <h5></h5>
                        </div>
                    </div>
                </div>`,
                "text/html").body.firstChild;

            if (eventAccordionContainer) {
                eventsListContainer.innerHTML = "";
                eventsListContainer.appendChild(eventAccordionContainer);
                this._platformUIDOMElement.platformSourceList.loadingSpinner = document.getElementById("loading-spinner");
                this._platformUIDOMElement.platformSourceList.initialText = document.getElementById("initial-text");
            }
        }

        if (!stsToken) {
            this._spinner(false);
            this._showLogs({
                code: "STS Token Login",
                message: "Invalid STS token!",
                type: 'error'
            });
            return;
        }

        configDataSource = {
            serverUrl: "",
            ownerUid: "",
            mediaUid: "",
            playbackMode: "",
            appToken: "",
            primaryAccount: "",
            newServer: true,
            analytics: true,
            stsToken: "",
            forwardBuffer: null,
            backwardBuffer: null
        }
        this._spinner(true);
        configDataSource.stsToken = stsToken;
        this.getRightsGroup(configDataSource.stsToken);
    }

    getRightsGroup(stsToken) {
        if (!stsToken) {
            this._showLogs({
                code: "Get Rights Group",
                message: "Invalid STS token!",
                type: 'error'
            });
            return;
        }

        const headers = {
            "Authorization": `OAUTH2 access_token="${stsToken}"`
        }

        const requestParam = {
            method: RequestType.get,
            url: requestURLs.rightsGroupUrl,
            others: {
                headers: headers
            }
        }

        this._sendRequest(requestParam)
            .then((res) => {
                if (res && res.AccountId) {
                    configDataSource.primaryAccount = res.AccountId;
                }
                if (res && res.ServiceMap && res.ServiceMap.Services && res.ServiceMap.Services.discovery) {
                    requestURLs.bootStrapUrl = `${res.ServiceMap.Services.discovery}/v1/events`;
                }
                if (res && res.ServiceMap && res.ServiceMap.Services && res.ServiceMap.Services.subscriber) {
                    requestURLs.subscriberUrl = `${res.ServiceMap.Services.subscriber}v1/events`;
                }

                if (res && res.ServiceMap) {
                    const serviceMap = res.ServiceMap;
                    const servicePrefix = serviceMap.Prefixes;
                    const services = serviceMap.Services;
                    const currentPrefix = servicePrefix["2ft"];
                    let parsed = new URL(services.defaultAccHostName)
                    parsed.host = currentPrefix + parsed.host;
                    configDataSource.serverUrl = this._parseUri(parsed.href);
                }

                if (res && res.RightsGroupIds) {
                    this.getBootStrap(res.RightsGroupIds);
                }
            }).catch((e) => {
                this._spinner(false);
            });
        return;
    }

    getBootStrap(rightsGroupIds) {
        if (!rightsGroupIds) {
            this._showLogs({
                code: "Get Bootstrap Details",
                message: "Invalid Rights Group Ids!",
                type: 'error'
            });
            return;
        }

        const currentTime = Date.now();
        const data = {
            $groups: rightsGroupIds,
            timeRange: `${new Date(new Date(currentTime).setDate(new Date(currentTime).getDate() - 6)).toISOString()},${new Date(new Date(currentTime).setDate(new Date(currentTime).getDate() + 2)).toISOString()}`
        }

        const requestParam = {
            method: RequestType.get,
            url: requestURLs.bootStrapUrl,
            others: {
                params: data
            }
        }
        this._sendRequest(requestParam)
            .then((res) => {
                if (res) {
                    this.populateEvents(res);
                }
            }).catch((e) => {
                this._spinner(false);
            });
        return;
    }

    populateEvents(events) {
        if (!events || !events.length) {
            this._showLogs({
                code: "Show Events",
                message: "Invalid Event List!",
                type: 'error'
            });
            return;
        }

        let eventMap = {};

        for (let x = 0; x < events.length; x++) {
            let event = events[x];
            if (!(eventMap.hasOwnProperty(event.EventStatus))) {
                eventMap[event.EventStatus] = [];
            }
            const eventObj = {
                name: event.Name[0].Value,
                externalId: event.ExternalId,
                airDate: event.OriginalAirDate
            }
            eventMap[event.EventStatus].push(eventObj);
        }

        const eventAccordionContainer = new DOMParser().parseFromString(
            `<div class="accordion-body">
                <div class="list-group source-list" id="event-source-list">
                    <!-- JavaScript will populate the source list items if a valid source list config is fed to it. -->
                </div>
            </div>`,
            "text/html").body.firstChild;

        if (eventAccordionContainer) {
            this._platformUIDOMElement.platformSourceList.eventsListContainer.innerHTML = "";
            this._platformUIDOMElement.platformSourceList.eventsListContainer.appendChild(eventAccordionContainer);
        }

        var eventSourceListElement = document.getElementById('event-source-list');

        let eventOrder = {
            0: "Started",
            1: "Final",
            2: "Completed",
            3: "Scheduled"
        };

        for (var order of Object.keys(eventOrder).sort()) {
            const eventType = eventOrder[order];
            if (Object.keys(eventMap).indexOf(eventType) < 0) {
                continue;
            }
            const eventTypeContainer = new DOMParser().parseFromString(
                `<div class="event-type">
                    <div class="event-type-title">${eventType}</div>
                    <div class="list-group source-list accordion" id="${eventType}-list">
                        <!-- JavaScript will populate the source list items if a valid source list config is fed to it. -->
                    </div>
                </div>`,
                "text/html").body.firstChild;
            // append the source list item container to the source list
            if (eventTypeContainer) {
                eventSourceListElement.appendChild(eventTypeContainer);
            }
            var eventTypeChildListElement = document.getElementById(`${eventType}-list`);

            for (var index = 0; index < eventMap[eventType].length; index++) {
                const title = eventMap[eventType][index].hasOwnProperty("name") && eventMap[eventType][index].name ? eventMap[eventType][index].name : "";
                const externalId = eventMap[eventType][index].hasOwnProperty("externalId") && eventMap[eventType][index].externalId ? eventMap[eventType][index].externalId : "";
                let airDate = eventMap[eventType][index].hasOwnProperty("airDate") && eventMap[eventType][index].airDate ? eventMap[eventType][index].airDate : "";
                airDate = new Date(Date.parse(airDate));
                const sourceListItem = new DOMParser().parseFromString(
                    `<div class="accordion-item"></div>`,
                    "text/html").body.firstChild;
                if (sourceListItem) {
                    eventTypeChildListElement.appendChild(sourceListItem);
                }

                var sourceEnvTabContainerElement = eventTypeChildListElement.lastChild;
                const sourceEnvTabHeader = new DOMParser().parseFromString(
                    `<a id="${eventType}-list-item-${index}" role="button" class="list-group-item list-group-item-action flex-column align-items-start event-list-item">
                        <div class="d-flex w-100 justify-content-between">
                            <h6 class="mb-2 h6 asset-title">${title}</h6>
                        </div>
                        <small>${airDate.toLocaleString('en-US', { hour12: true })}</small>
                    </a>`,

                    "text/html").body.firstChild;
                // append the source list item header to the source list item container
                if (sourceEnvTabHeader) {
                    sourceEnvTabContainerElement.appendChild(sourceEnvTabHeader);
                }

                const sourceEnvTabBody = new DOMParser().parseFromString(
                    `<div class="list-group production-list" id="${externalId}-source-list">
                        <!-- JavaScript will populate the source list items if a valid source list config is fed to it. -->
                    </div>`,
                    "text/html").body.firstChild;

                // append the source list item body to the source list item container
                if (sourceEnvTabBody) {
                    sourceEnvTabContainerElement.appendChild(sourceEnvTabBody);
                }
            }
        }

        const sourceItemList = document.querySelectorAll(".event-list-item");
        sourceItemList.forEach((item) => {
            item.addEventListener('click', (event) => {
                // Remove 'active' tag for all source items
                for (let i = 0; i < sourceItemList.length; i++) {
                    sourceItemList[i].classList.remove("active");
                }

                // Add 'active' tag for currently selected item
                item.classList.add("active");

                // call the source item selection handler
                this.onEventSelected(item.id);
            });
        });

        const defaultEnv = this._platformUIDOMElement.login.environmentDropdown.options[this._platformUIDOMElement.login.environmentDropdown.selectedIndex].value;
        this._platformUIDOMElement.platformSourceList.eventsListContainer.parentElement.querySelector('.accordion-button').innerHTML = `Events - ${defaultEnv}`;

        this._spinner(false);
    }

    onEventSelected(id) {
        RefAppUIMgr.clearErrorMessage();
        const externalId = document.getElementById(id).parentElement.lastChild.id.split("-")[0];

        if (!externalId) {
            this._showLogs({
                code: "Get Productions",
                message: "Invalid Event Id!",
                type: 'error'
            });
            return;
        }

        const data = {
            isExternalId: true
        }

        const headers = {
            Authorization: `OAUTH2 access_token="${configDataSource.stsToken}"`
        }

        const url = `${requestURLs.subscriberUrl}/${externalId}/play-options`;

        const requestParam = {
            method: RequestType.get,
            url: url,
            others: {
                headers: headers,
                params: data,
            }
        }

        this._sendRequest(requestParam)
            .then((res) => {
                if (res) {
                    this.populateProductions(id, res);
                }
            }).catch((e) => {
                this._spinner(false);
            });
        return;
    }

    populateProductions(id, res) {
        // Callback method for event list click
        let onProductionEventSelected = function (productionEventid) {
            RefAppUIMgr.clearErrorMessage();
            if (!productionEventid) {
                return;
            }

            if (productionList.hasOwnProperty('Schedules') && productionList.Schedules.length) {
                for (let i = 0; i < productionList.Schedules.length; i++) {
                    if (productionList.Schedules[i].mediaId && productionEventid === productionList.Schedules[i].mediaId) {
                        configDataSource.playbackMode = "LIVE";
                        configDataSource.appToken = productionList.Schedules[i].appToken;
                        configDataSource.ownerUid = productionList.Schedules[i].ownerId;
                        configDataSource.mediaUid = productionList.Schedules[i].mediaId;
                        configDataSource.forwardBuffer = 12;
                        configDataSource.backwardBuffer = 12;
                        break;
                    }
                }
            }

            if (productionList.hasOwnProperty('Vods') && productionList.Vods.length) {
                for (let i = 0; i < productionList.Vods.length; i++) {
                    if (productionList.Vods[i].mediaId && productionEventid === productionList.Vods[i].mediaId) {
                        configDataSource.playbackMode = "VOD";
                        configDataSource.appToken = "";
                        configDataSource.ownerUid = productionList.Vods[i].ownerId;
                        configDataSource.mediaUid = productionList.Vods[i].mediaId;
                        configDataSource.forwardBuffer = "";
                        configDataSource.backwardBuffer = "";
                        break;
                    }
                }
            }

            // clear external source parameters
            if (RefAppUIMgr._uiDOMElement.config.externalSourceUrl) {
                RefAppUIMgr._uiDOMElement.config.externalSourceUrl.value = "";
            }
            if (RefAppUIMgr._uiDOMElement.config.externalSourceLicenseUrl) {
                RefAppUIMgr._uiDOMElement.config.externalSourceLicenseUrl.value = "";
            }
            // populate the source parameters
            if (configDataSource.hasOwnProperty("serverUrl") && configDataSource.serverUrl && RefAppUIMgr._uiDOMElement.config.ownerUid) {
                RefAppUIMgr._uiDOMElement.config.serverUrl.value = configDataSource.serverUrl;
            }
            if (configDataSource.hasOwnProperty("ownerUid") && configDataSource.ownerUid && RefAppUIMgr._uiDOMElement.config.ownerUid) {
                RefAppUIMgr._uiDOMElement.config.ownerUid.value = configDataSource.ownerUid;
            }
            if (configDataSource.hasOwnProperty("primaryAccount") && configDataSource.primaryAccount && RefAppUIMgr._uiDOMElement.config.primaryAccount) {
                RefAppUIMgr._uiDOMElement.config.primaryAccount.value = configDataSource.primaryAccount;
            }
            if (configDataSource.hasOwnProperty("tenantId") && configDataSource.tenantId && RefAppUIMgr._uiDOMElement.config.tenantId) {
                RefAppUIMgr._uiDOMElement.config.tenantId.value = configDataSource.tenantId;
            }
            if (configDataSource.hasOwnProperty("mediaUid") && configDataSource.mediaUid && RefAppUIMgr._uiDOMElement.config.mediaUid) {
                RefAppUIMgr._uiDOMElement.config.mediaUid.value = configDataSource.mediaUid;
            }
            if (configDataSource.hasOwnProperty("appToken") && configDataSource.appToken && RefAppUIMgr._uiDOMElement.config.appToken) {
                RefAppUIMgr._uiDOMElement.config.appToken.value = configDataSource.appToken;
            } else {
                RefAppUIMgr._uiDOMElement.config.appToken.value = "";
            }
            if (configDataSource.hasOwnProperty("stsToken") && configDataSource.stsToken && RefAppUIMgr._uiDOMElement.config.stsToken) {
                RefAppUIMgr._uiDOMElement.config.stsToken.value = configDataSource.stsToken;
            }
            if (configDataSource.hasOwnProperty("inhomeServerUrl") && configDataSource.inhomeServerUrl && RefAppUIMgr._uiDOMElement.config.inhomeServerUrl) {
                RefAppUIMgr._uiDOMElement.config.inhomeServerUrl.value = configDataSource.inhomeServerUrl;
            }
            if (configDataSource.hasOwnProperty("inhomeServerToken") && configDataSource.inhomeServerToken && RefAppUIMgr._uiDOMElement.config.inhomeServerToken) {
                RefAppUIMgr._uiDOMElement.config.inhomeServerToken.value = configDataSource.inhomeServerToken;
            }
            if (configDataSource.hasOwnProperty("catchupStartTime") && configDataSource.catchupStartTime && RefAppUIMgr._uiDOMElement.config.catchupStartTime) {
                RefAppUIMgr._uiDOMElement.config.catchupStartTime.value = configDataSource.catchupStartTime;
            } else {
                RefAppUIMgr._uiDOMElement.config.catchupStartTime.value = "";
            }
            if (configDataSource.hasOwnProperty("newServer") && configDataSource.newServer && RefAppUIMgr._uiDOMElement.config.newServerEnabled) {
                RefAppUIMgr._uiDOMElement.config.newServerEnabled.checked = true;
            } else {
                RefAppUIMgr._uiDOMElement.config.newServerEnabled.checked = false;
            }
            if (configDataSource.hasOwnProperty("analytics") && configDataSource.analytics && RefAppUIMgr._uiDOMElement.config.analyticsEnabled) {
                RefAppUIMgr._uiDOMElement.config.analyticsEnabled.checked = true;
            } else {
                RefAppUIMgr._uiDOMElement.config.analyticsEnabled.checked = false;
            }
            if (configDataSource.hasOwnProperty("manifestRetryCount") && configDataSource.manifestRetryCount && RefAppUIMgr._uiDOMElement.config.manifestRetryCount) {
                RefAppUIMgr._uiDOMElement.config.manifestRetryCount.value = configDataSource.manifestRetryCount;
            }
            if (configDataSource.hasOwnProperty("manifestRetryInterval") && configDataSource.manifestRetryInterval && RefAppUIMgr._uiDOMElement.config.manifestRetryInterval) {
                RefAppUIMgr._uiDOMElement.config.manifestRetryInterval.value = configDataSource.manifestRetryInterval;
            }
            if (configDataSource.hasOwnProperty("cdnFailoverPercentage") && configDataSource.cdnFailoverPercentage && RefAppUIMgr._uiDOMElement.config.cdnFailoverPercentage) {
                RefAppUIMgr._uiDOMElement.config.cdnFailoverPercentage.value = configDataSource.cdnFailoverPercentage;
            }
            if (configDataSource.hasOwnProperty("playbackMode") && configDataSource.playbackMode && RefAppUIMgr._uiDOMElement.config.playbackMode) {
                RefAppUIMgr._uiDOMElement.config.playbackMode.value = configDataSource.playbackMode;
            }
            if (configDataSource.hasOwnProperty("forwardBuffer") && configDataSource.forwardBuffer && RefAppUIMgr._uiDOMElement.config.forwardBuffer) {
                RefAppUIMgr._uiDOMElement.config.forwardBuffer.value = configDataSource.forwardBuffer;
            } else {
                RefAppUIMgr._uiDOMElement.config.forwardBuffer.value = "";
            }
            if (configDataSource.hasOwnProperty("backwardBuffer") && configDataSource.backwardBuffer && RefAppUIMgr._uiDOMElement.config.backwardBuffer) {
                RefAppUIMgr._uiDOMElement.config.backwardBuffer.value = configDataSource.backwardBuffer;
            } else {
                RefAppUIMgr._uiDOMElement.config.backwardBuffer.value = "";
            }
            configSaver.refreshCurrentConfig();
            RefAppUIMgr.triggerEvent(WMCRefAppUIManagerEvent.SourceListItemSelected);
        }

        const productionList = {};

        const elemsList = [].slice.call(document.getElementsByClassName("production-list"), 0);
        if (elemsList.length) {
            elemsList.forEach((elm) => {
                if (elm.classList.contains('is-visible')) {
                    this._hide(elm);
                }
            })
        }

        const productionListElement = document.getElementById(id).parentElement.lastChild;

        if (productionListElement.querySelector('.production-type')) {
            const show = this._toggle(productionListElement);
            if (show) {
                document.getElementById(id).classList.add('active');
            } else {
                document.getElementById(id).classList.remove('active');
            }
            return;
        }

        document.getElementById(id).classList.add('active');
        productionListElement.innerHTML = "";

        if (res && res.hasOwnProperty('Schedules') && res.Schedules.length) {
            productionList['Schedules'] = [];
            for (let i = 0; i < res.Schedules.length; i++) {
                for (let ii = 0; ii < res.Schedules[i].Productions.length; ii++) {
                    const prodObj = {
                        type: 'Schedules',
                        name: res.Schedules[i].Productions[ii].DisplayName[0].Value,
                        appToken: res.Schedules[i].Productions[ii].Id,
                        ownerId: res.Schedules[i].Productions[ii].Services[0].OwnerId,
                        mediaId: res.Schedules[i].Productions[ii].Services[0].MediaId
                    }
                    productionList['Schedules'].push(prodObj);
                }
            }
        }

        if (res && res.hasOwnProperty('Vods') && res.Vods.length) {
            productionList['Vods'] = [];
            for (let j = 0; j < res.Vods.length; j++) {
                const name = res.Vods[j].DisplayName[0].Value;
                for (let jj = 0; jj < res.Vods[j].PlayActions.length; jj++) {
                    const prodObj = {
                        type: 'Vods',
                        name: name,
                        ownerId: res.Vods[j].PlayActions[jj].VideoProfile.Owner,
                        mediaId: res.Vods[j].PlayActions[jj].VideoProfile.Id
                    }
                    productionList['Vods'].push(prodObj);
                }

            }
        }

        for (var productionType of Object.keys(productionList)) {
            const productionTypeContainer = new DOMParser().parseFromString(
                `<div class="production-type">
                    <div class="production-type-title">${productionType}</div>
                    <div class="list-group production-source-list" id="${productionType}-list">
                        <!-- JavaScript will populate the source list items if a valid source list config is fed to it. -->
                    </div>
                </div>`,
                "text/html").body.firstChild;
            // append the source list item container to the source list
            if (productionTypeContainer) {
                productionListElement.appendChild(productionTypeContainer);
            }
            var productionTypeChildListElement = productionListElement.lastChild.querySelector('.production-source-list')

            for (var index = 0; index < productionList[productionType].length; index++) {
                const title = productionList[productionType][index].hasOwnProperty("name") && productionList[productionType][index].name ? productionList[productionType][index].name : "";
                const mediaId = productionList[productionType][index].hasOwnProperty("mediaId") && productionList[productionType][index].mediaId ? productionList[productionType][index].mediaId : "";
                const sourceListItem = new DOMParser().parseFromString(
                    `<a id="${mediaId}" role="button" class="list-group-item list-group-item-action flex-column align-items-start production-list-item">
                        <div class="d-flex w-100 justify-content-between">
                            <h6 class="mb-2 h6 asset-title">${title}</h6>
                        </div>
                        <small>${mediaId}</small>
                    </a>`,
                    "text/html").body.firstChild;
                if (sourceListItem) {
                    productionTypeChildListElement.appendChild(sourceListItem);
                }
            }
        }

        this._toggle(productionListElement);

        const sourceItemList = document.querySelectorAll(".production-list-item");
        sourceItemList.forEach((item) => {
            item.addEventListener('click', (event) => {
                // Remove 'active' tag for all source items
                for (let i = 0; i < sourceItemList.length; i++) {
                    sourceItemList[i].classList.remove("active");
                }

                // Add 'active' tag for currently selected item
                item.classList.add("active");

                // call the source item selection handler
                onProductionEventSelected(item.id);
            });
        });

    }

    populateEnvironments(config) {
        if (!config) {
            this._platformUIDOMElement.nba.tab.style.display = "none";
            this._platformUIDOMElement.nba.tabContent.style.display = "none";
        }

        if (config && !config.showLogin) {
            this._platformUIDOMElement.login.username.parentElement.parentElement.style.display = "none";
            this.withoutLogin = true;
        }

        if (config && config.hasOwnProperty("environments") && Object.keys(config.environments).length) {
            allConfig = config.environments;
        }

        this._platformUIDOMElement.platformSourceList.initialText.querySelector("h5").innerHTML = this.withoutLogin ? "Select environment load event list" : "Login to load event list";

        // append the environments to select environment dropdown
        for (let env in allConfig) {
            const envDetails = allConfig[env];
            const envOptions = new DOMParser().parseFromString(
                `<option value="${env}"${!(envDetails.active) ? " disabled" : ""} ${envDetails.defaultSelection ? " selected" : ""}>${env}</option>`
                , "text/html").body.firstChild;
            if (envOptions) {
                this._platformUIDOMElement.login.environmentDropdown.appendChild(envOptions);
            }

            if (envDetails.defaultSelection) {
                requestURLs = envDetails;
                if (this.withoutLogin && envDetails.stsToken) {
                    this.withoutPlatformLogin(envDetails.stsToken);
                }
            }
        }
        if (!Object.keys(requestURLs).length) {
            this.setRequestUrls();
        }
    }

    /* Class constructor */
    constructor() {
        this._platformUIDOMElement = {
            nba: {
                tab: document.getElementById("platform-params-tab"),
                tabContent: document.getElementById("platform-params")
            },
            login: {
                environmentDropdown: document.getElementById("platform-environment"),
                username: document.getElementById("platform-username"),
                password: document.getElementById("platform-password"),
                loginBtn: document.getElementById("platform-login-btn")
            },
            platformSourceList: {
                title: document.getElementById("platform-title"),
                eventsListContainer: document.getElementById("events-list-card"),
                loadingSpinner: document.getElementById("loading-spinner"),
                initialText: document.getElementById("initial-text")
            }
        };

        /* populate the NBA tab */
        let nbConfigFile = "resources/config/env_config.json"; // default file
        const nbaConfig = RefAppUIMgr.loadConfigFile(nbConfigFile, this.populateEnvironments.bind(this))

        // this._platformUIDOMElement.platformSourceList.title.innerHTML = Platform;
        this._spinner(false);

        /* register necessary event handlers */
        this._platformUIDOMElement.login.loginBtn.addEventListener("click", this.onPlatformLogin.bind(this));
        this._platformUIDOMElement.login.environmentDropdown.addEventListener("change", this.setRequestUrls.bind(this));
    }
}

const Platform = "NBA";
const PlatformRefAppUIManager_TAG = "PlatformRefAppUIManager";
let allConfig = {};
let requestURLs = {};
let configDataSource = {
    serverUrl: "",
    ownerUid: "",
    tenantId: "",
    mediaUid: "",
    playbackMode: "",
    appToken: "",
    primaryAccount: "",
    newServer: true,
    analytics: true,
    stsToken: "",
    forwardBuffer: null,
    backwardBuffer: null
}
let RefAppUIMgr = null;
let withoutLogin = false;

// Get hold of the RefApp UI Manager
document.addEventListener("WMCRefAppLoaded", () => {
    RefAppUIMgr = (typeof uiMgr !== 'undefined' && uiMgr) ? uiMgr : null;
    if (!RefAppUIMgr) {
        throw "[PlatformRefAppUIManager] Failed to get hold of WMCRefAppUIManager";
    }
    new PlatformRefAppUIManager();
})


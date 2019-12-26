/**
 * @file See {@link BlinkReceipt} for library properties and methods
 * @author BlinkReceipt LLC
 */

const thisScriptFileName = 'blinkreceipt.js';

import $ from 'jquery';


let path = null;
if (document.currentScript) {
    path = document.currentScript.src;
} else {
    let scripts = document.getElementsByTagName('script');
    path = scripts[scripts.length-1].src;
}
if (!path) {
    path = $('script[src*='+$.escapeSelector(thisScriptFileName)+']').attr('src');
}
const baseURL = path.split('/').slice(0, -1).join('/')+'/';


/** @namespace */
const BlinkReceiptError = {
    /**
     * Live scanning in the mobile browser is only supported on HTTPS web applications
     */
    INSECURE: 0,

    /**
     * Failed to initialize the video stream. It may not be supported in the user's browser
     */
    STREAMFAIL: 1,

    /**
     * API failed to scan a receipt frame
     */
    SCANFAIL: 2,

    /**
     * API determined frame was too blurry to be scanned
     */
    BLURRYFRAME: 3
};

/** @namespace **/
window.BlinkReceipt = {
    /**
     * You must provide a valid BlinkReceipt API key to use this library. You can obtain a trial license at {@link https://microblink.com/signup} 
     *
     * **Required**
     * @type {string}
     */
    apiKey: null,

    /**
     * If you want to target a specific version of the API, set this value. Otherwise defaults to the latest available version
     *
     * _Optional_
     * @type {integer}
     */
    apiVersion: null,

    /**
     * Set to `true` to turn on promotion validation (requires appropriate permission on your API key)
     *
     * _Optional_
     * @type {boolean}
     */
    validatePromotions: false,

    /**
     * If `validatePromotions` is enabled, you can pass one or more promotion IDs to restrict validation to those campaigns
     *
     * _Optional_
     * @type {Array.<string>}
     * @example ['campaign1','campaign2']
     */
    promotionIds: null,

    /**
     * Set to `true` to turn on duplicate detection. After scanning, in `parseResults` you will find two properties: `isDuplicate` (boolean) and `duplicateBlinkReceiptId` (string)
     *
     * _Optional_
     * @type {boolean}
     */
    detectDuplicates: false,

    /**
     * The country code of the receipts being scanned
     *
     * _Optional_
     * @type {string}
     * @default US
     */
    countryCode: 'US',

    /**
     * An identifier for the current user to be used for purchase validation in API v11 and up
     *
     * _Optional_
     * @type {string}
     */
    clientUserId: '',

    /**
     * After the camera capture, image will be cropped out by this percentage amount; this value is the offset from the top
     *
     * _Optional_
     * @type {number}
     */
    cameraCaptureCropPercentTop: 0,

    /**
     * After the camera capture, image will be cropped out by this percentage amount; this value is the offset from the bottom
     *
     * _Optional_
     * @type {number}
     */
    cameraCaptureCropPercentBottom: 0,

    /**
     * After the camera capture, image will be cropped out by this percentage amount; this value is the offset from the left
     *
     * _Optional_
     * @type {number}
     */
    cameraCaptureCropPercentLeft: 0,

    /**
     * After the camera capture, image will be cropped out by this percentage amount; this value is the offset from the right
     *
     * _Optional_
     * @type {number}
     */
    cameraCaptureCropPercentRight: 0,

    /**
     * Debugging mode; more info will be shown in the console if this is set to true
     *
     * _Optional_
     * @type {boolean}
     */
    debugMode: false,

    oldBgColor: null,
    gumVideo: null,
    cameraClickSound: null,
    showAddButton: false,
    inSelectMode: false,
    waitingForScanResults: false,
    finishPending: false,
    parseResults: null,
    curFrameIdx: 1,
    blinkReceiptId: null,
    linuxArgs: null,
    apiDomain: "scan.blinkreceipt.com",
    frames: [],
    framesTimedOut: 0,
    sdkVersion: 'mobileweb-1.1',
    qualifiedPromoDbId: null,
    staticImages: [],
    xhrSendImageToScannerQueue: [],

    showDebugInfo: function($label, $data) {
        if (this.debugMode) console.log($label+' :', $data);
    },

    /**
     * This callback is invoked during creation of UI elements. You may override this in your instance to customize these specific elements, provided you preserve the `id`-attribute values, because they will be bound to events/callbacks.
     *
     * @param $parentContainer {object} the JQuery element that is the parent container for all other BlinkReceipt-JS elements.
     * @param $elemCenter {object} a JQuery mid-level element that is horizontally centered and will contain the captured image, as well as the action buttons.
     */
    onCreateUI: function($parentContainer, $elemCenter) {
        this.showDebugInfo('method', 'onCreateUI');

        let $elemEdge1 = $('<span class="brjs-edgeLabel">Receipt Edge</span>')
            .css({
                top: $(window).height() / 2 + 'px',
                left: '0px',
                display: ''
            })
            .css('-webkit-transform', 'translate(-35%, 0) rotate(-90deg)');
        $parentContainer.append($elemEdge1);

        let $elemEdge2 = $('<span class="brjs-edgeLabel">Receipt Edge</span>')
            .css({
                top: $(window).height() / 2 + 'px',
                right: '0px',
                display: ''
            })
            .css('-webkit-transform', 'translate(35%, 0) rotate(90deg)');
        $parentContainer.append($elemEdge2);

        let $elemDivButtonBar = $('<div id="brjs-divButtonBar">');
        let $elemTableButtons = $('<table border=0 width=100% id="brjs-tblButtons">');
        let $elemRowButtons = $('<tbody><tr><td align="center"><button id="brjs-btnSecondaryAction" class="brjs-actionButton">Cancel</button></td><td align="center"><button id="brjs-snap" class="brjs-cameraButton"></button></td><td align="center"><button id="brjs-finish" class="brjs-actionButton">Finish</button></td></tr></tbody>');
        $elemTableButtons.append($elemRowButtons);
        $elemDivButtonBar.append($elemTableButtons);
        $elemCenter.append($elemDivButtonBar);  // $elemCenter gets appended to $parentContainer internally after this

        let $elemSpinner = $('<div id="brjs-imgSpinner" style="position: absolute; width: 100px; height: 100px; display: none;">');
        $elemSpinner.css({
            left: (($(window).width() - $elemSpinner.width()) / 2) + 'px',
            top:  (($(window).height() - $elemSpinner.height()) / 2) + 'px'
        });
        $parentContainer.append($elemSpinner);
    },

    /**
     * This callback is invoked after a static scan is performed (select image).
     */
    onStartStaticScan: function() {
        this.showDebugInfo('method', 'onStartStaticScan');

        $('#brjs-snap').removeClass('brjs-cameraButton').addClass('brjs-plusButton');

        if ($(window).width() > 500) {
            $('#brjs-tblButtons').css('position', 'relative');
        }
    },

    /**
     * This callback is invoked after the mobile scan is performed.
     */
    onStartMobileScan: function() {
        this.showDebugInfo('method', 'onStartMobileScan');

        this.oldBgColor = $('body').css('backgroundColor');
        $('body').css('backgroundColor', 'black');
        $('#brjs-tblButtons').css({position:'absolute', left:'0'});
    },

    /**
     * This callback is invoked when the plus-sign button is clicked on, to sideline the previously-captured frame and prepare the interface to receive another "click".
     *  You may override this in your instance to customize the display of the captured frame(s) and related user interface.
     */
    onAddScanButtonClicked: function() {
        this.showDebugInfo('method', 'onAddScanButtonClicked');

        //if we have a previous static image, detach and re-insert it below current image so that current image will appear on top
        if (this.staticImages.length > 1) {
            let prevImg = this.staticImages[this.staticImages.length-2];
            prevImg.detach().prependTo($('#brjs-container'));
        }

        if (this.staticImages.length > 0) {
            let curImg = this.staticImages[this.staticImages.length-1];
            curImg.animate({
                top: "-=" + curImg.height() * 0.9
            });
        }

        $('#brjs-finish').css('visibility', 'hidden');
        $('#brjs-snap').removeClass('brjs-plusButton').addClass('brjs-cameraButton');
        $('#brjs-btnSecondaryAction').text('Cancel');
    },

    /**
     * This callback is invoked at the point that the camera "snap" button is clicked on but before the "winning" frame has been acquired..
     */
    onScanInitiated: function() {
        this.showDebugInfo('method', 'onScanInitiated');

        this.cameraClickSound.play();
        $('#brjs-imgSpinner').show();
    },

    /**
     * This callback is invoked after a scan and after we’ve considered a number of frames from the video stream and chosen the best (winning) one.
     *  You may override this in your instance to customize the display of the captured frame and related user interface.
     *
     * @param winningDataUrl {string} output of the HTMLCanvasElement.toDataURL() method, of type 'image/jpeg'; a UTF-16 string (https://developer.mozilla.org/en-US/docs/Web/API/DOMString). It can be assigned to the "src" attribute of an <img> tag.
     */
    onScanAcquired: function(winningDataUrl) {
        this.showDebugInfo('method', 'onScanAcquired');

        $('#brjs-imgSpinner').hide();

        let scaleW = $('#brjs-gum').width() / this.gumVideo.videoWidth;
        let scaleH = $('#brjs-gum').height() / this.gumVideo.videoHeight;
        let scaleFactor = Math.min(scaleW, scaleH);

        let $imgStatic = $('<img style="position: absolute; display: none">');
        $imgStatic.css('width', scaleFactor * this.gumVideo.videoWidth + 'px');
        $imgStatic.css('height', scaleFactor * this.gumVideo.videoHeight + 'px');
        $imgStatic.css('left', (screen.width - scaleFactor * this.gumVideo.videoWidth) / 2 + "px");
        $imgStatic.css('top', '0px');

        $('#brjs-container').prepend($imgStatic);

        $imgStatic.on('load', function() {
            $imgStatic.show();
            $('#brjs-gum').hide();
            $('#brjs-finish').css('visibility', 'visible');
            $('#brjs-btnSecondaryAction').css('visibility', 'visible');
            $('#brjs-btnSecondaryAction').text('Retake');
            $('#brjs-snap').removeClass('brjs-cameraButton').addClass('brjs-plusButton');
        });

        $imgStatic.get(0).setAttribute('src', winningDataUrl);

        this.staticImages.push($imgStatic);
    },

    /**
     * This callback is invoked when the #brjs-finish button is clicked on but there is still a product-info lookup in progress. The product-info lookup is started right after onScanAcquired() (for mobile scan),
     *  or onUserChoseImage() (for "static" image selection).
     */
    onWaitingForScanResults: function() {
        this.showDebugInfo('method', 'onWaitingForScanResults');

        $('#brjs-imgSpinner').show();
    },

    /**
     * This callback is invoked once the user has indicated the scanning session is complete.
     * @param parseResults {object} For the structure of the results object consult the response schema in the API docs at {@link https://app.swaggerhub.com/apis-docs/blinkreceipt/apiscan}
     * @param jsonString {string} This is the raw JSON string on which the hash was computed
     * @param hash {string} This is the SHA-256 HMAC hash computed on the `jsonString` using your client secret as the key
     */
    onFinished: function(parseResults, jsonString, hash) {
        this.showDebugInfo('method', 'onFinished');

        $('body').css('backgroundColor', this.oldBgColor);
        $('#brjs-container').hide();
    },

    /**
     * This callback is invoked once per scanned frame, as soon as results are ready. The results will be aggregated for all frames scanned up to this point.
     * @param parseResults {object} For the structure of the results object consult the response schema in the API docs at {@link https://app.swaggerhub.com/apis-docs/blinkreceipt/apiscan}
     */
    onPreliminaryResults: function(parseResults) {
        this.showDebugInfo('method', 'onPreliminaryResults');
    },

    /**
     * This callback is invoked when the secondary button is clicked. Since our stock UI uses one button for multiple actions, this code decides how to differentiate them.
     *  You may want to impelement yours differently, by overriding this. Or you may want to use your own separate buttons, in which case you'd still need to bind them to the respective functions shown here,
     *  and bypass this callback altogether.
     */
    onBtnSecondaryActionClick: function() {
        this.showDebugInfo('method', 'onBtnSecondaryActionClick');

        if ($('#brjs-btnSecondaryAction').text() == 'Retake') {
            this.retakeScan();
        } else if ($('#brjs-btnSecondaryAction').text() == 'Cancel') {
            this.cancelScan();
        }
    },

    /**
     * This callback is invoked if the user cancels out of the scanning session.
     */
    onCancelScan: function() {
        this.showDebugInfo('method', 'onCancelScan');

        this.staticImages.forEach(function(curStaticImg) {
            curStaticImg.remove();
        });
        this.staticImages = [];

        $('body').css('backgroundColor', this.oldBgColor);
        $('#brjs-tblButtons').css({position:'', left:''});  // these are set only for mobile scan, so we clear them
    },

    /**
     * Obsolesced, now wrapper for onCancelScan().
     */
    onCancelled: function() {
        this.onCancelScan();
    },

    /**
     * This callback is invoked after `finishClick`, and only after the scan results have returned (it will wait to invoke `onEndScan`), but before `returnResults`.
     */
    onEndScan: function() {
        this.showDebugInfo('method', 'onEndScan');

        this.staticImages.forEach(function(curStaticImg) {
            curStaticImg.remove();
        });
        this.staticImages = [];

        $('#brjs-tblButtons').css({position:'', left:''});  // these are set only for mobile scan, so we clear them
    },

    /**
     * This callback is invoked in "static" scanning mode once the user has selected an image but before it has loaded.
     */
    onstaticImgChange: function() {
        this.showDebugInfo('method', 'onstaticImgChange');

        if ($('#brjs-imgStatic').attr('src')) {
            $('#brjs-imgStatic').clone().attr('id',null).attr('class','brjs-imgStatic-additions').css({display:'block', padding:'10px'}).insertBefore('#brjs-imgStatic');
        }
    },

    /**
     * This callback is invoked in "static" scanning mode once the user has selected an image and it has loaded. It is specific to the <input> tag of type="file" with id="brjs-inputImage",
     *  which is auto-generated by the core code.
     */
    onUserChoseImage: function() {
        if (typeof this.showDebugInfo === 'function') this.showDebugInfo('method', 'onUserChoseImage');     // method might not exist due to "parentStub" caller

        $('#brjs-finish').css('visibility', 'visible');
        $('#brjs-snap').css('visibility', 'visible');
        $('#brjs-btnSecondaryAction').css('visibility', 'visible');
        $('#brjs-btnSecondaryAction').text('Cancel');

        if ($(window).width() > 500) {
            $('#brjs-divButtonBar').css('width', $('#brjs-imgStatic').width() + 'px');
        } else {
            $('#brjs-divButtonBar').css('width', '100%');
        }

        if ($('.brjs-imgStatic-additions').length) {
            $('html, body').animate({
                scrollTop: $('.brjs-imgStatic-additions').last().offset().top
            }, 0, function() { $('html, body').animate({ scrollTop: $(document).height() }, 'slow'); });
        } else {
            $('html, body').animate({ scrollTop: $(document).height() }, 'slow');
        }
    },

    /**
     * This callback is invoked after the retaking of a scan ("retake" button).
        */
    onRetakeScan: function() {
        this.showDebugInfo('method', 'onRetakeScan');

        if (this.staticImages.length > 0) {
            let lastImg = this.staticImages.pop();
            lastImg.remove();
        }

        $('#brjs-finish').css('visibility', 'hidden');
        $('#brjs-btnSecondaryAction').text('Cancel');
        $('#brjs-snap').removeClass('brjs-plusButton').addClass('brjs-cameraButton');
    },

    /**
     * This callback is invoked after a scan is finished or cancelled, to reset variables and UI elements.
     */
    onClearScan: function() {
        this.showDebugInfo('method', 'onClearScan');

        $('#brjs-snap').removeClass('brjs-plusButton').addClass('brjs-cameraButton');
        $('#brjs-snap').css('visibility', 'hidden');
        $('#brjs-finish').css('visibility', 'hidden');
        $('#brjs-btnSecondaryAction').css('visibility', 'hidden');
        $('#brjs-imgStatic').attr('src',null);
        $('.brjs-imgStatic-additions').remove();
    },

    /**
     * This callback is invoked when a mobile-scan session has begun and the capture stream has successfully started (the camera is active and waiting for the "snap click").
     */
    onStreamCaptureSuccess: function() {
        this.showDebugInfo('method', 'onStreamCaptureSuccess');

        $('#brjs-snap').prop('disabled', false);
    },

    /**
     * This callback is invoked if an error occurs during the scanning session
     * @param errorCode {BlinkReceiptError} The code indicating what type of error occurred
     * @param msg {string} Additional information about the error
     */
    onStreamCaptureError: function(errorCode, msg) {
        this.showDebugInfo('method', 'onStreamCaptureError');
    },

    /**
     * Obsolesced, now wrapper for onStreamCaptureError().
     */
    onError: function(errorCode, msg) {
        this.onStreamCaptureError(errorCode, msg);
    },

    /**
     * This callback is invoked after the video stream is captured, and the best-quality frame assigned to the main video element as the receipt scan image.
     */
    onStreamLoadedMetadata: function() {
        this.showDebugInfo('method', 'onStreamLoadedMetadata');

        $('#brjs-tblButtons').css('top', ($(window).height() - $('#brjs-tblButtons').height()) + 'px');
        $('#brjs-snap').css('visibility', 'visible');
        $('#brjs-btnSecondaryAction').css('visibility', 'visible');
        $('#brjs-btnSecondaryAction').text('Cancel');
    },

    // ++++++++++++++++ end callbacks section ++++++++++++++++


    isSecureOrigin: function() {
        return (location.protocol === 'https:' || location.hostname === 'localhost');
    },

    /**
     * Initiate a live scanning session
     */
    startMobileScan: function() {
        this.showDebugInfo('method', 'startMobileScan');

        if (!this.isSecureOrigin()) {
            this.onStreamCaptureError(BlinkReceiptError.INSECURE, 'getUserMedia() must be run from a secure origin: HTTPS or localhost.');
            return;
        }

        const constraints = {
            audio: false,
            video: {
                width: {ideal: 1920, min: 1280},
                height: {ideal: 1080, min: 720},
                facingMode:
                {
                    ideal: "environment"
                }
            }
        };
        navigator.mediaDevices.getUserMedia(constraints).then(this.handleStreamCaptureSuccess.bind(this)).catch(this.handleStreamCaptureError.bind(this));

        let currentDate = new Date();
        this.sessionStartTime = currentDate.getTime() / 1000;

        this.onStartMobileScan();
    },

    handleStreamCaptureSuccess: function(stream) {
        this.showDebugInfo('method', 'handleStreamCaptureSuccess');

        window.stream = stream;
        this.gumVideo.srcObject = stream;
        this.gumVideo.style.display = '';

        this.onStreamCaptureSuccess();
    },

    handleStreamCaptureError: function(error) {
        this.showDebugInfo('method', 'handleStreamCaptureError');

        this.onStreamCaptureError(BlinkReceiptError.STREAMFAIL, 'Failure to get stream: ' + error);
    },

    /**
     * Initiate a static scanning session
     */
    startStaticScan: function() {
        this.showDebugInfo('method', 'startStaticScan');

        this.inSelectMode = true;

        //this.blinkReceiptId = this.uuidv4();

        let currentDate = new Date();
        this.sessionStartTime = currentDate.getTime() / 1000;

        $('#brjs-inputImage').click();

        this.onStartStaticScan();
    },

    /**
     * Reset state to prepare for a new scan (not required for 1st scan)
     */
    clearScan: function() {
        this.showDebugInfo('method', 'clearScan');

        this.parseResults = null;
        this.curFrameIdx = 1;
        this.blinkReceiptId = null;
        this.waitingForScanResults = false;
        this.showAddButton = false;
        this.inSelectMode = false;
        this.finishPending = false;
        this.staticImages = [];

        $('#brjs-container').show();
        $('#brjs-gum').hide();
        $('#brjs-imgStatic').hide();
        $('#brjs-inputImage').val('');

        this.onClearScan();
    },

    createUI: function() {
        this.showDebugInfo('method', 'createUI');

        let $parentContainer = $('#brjs-container');

        let $elemVideo = $('<video id="brjs-gum" autoplay muted playsinline style="display:none; object-fit:fill;"></video>');
        $parentContainer.append($elemVideo);

        this.gumVideo = document.querySelector('video#brjs-gum');
        this.cameraClickSound = new Audio(baseURL + 'media/camera.wav');

        let $elemCenter = $('<center>');
        let $elemImgStatic = $('<img id="brjs-imgStatic">');
        $elemCenter.append($elemImgStatic);

        this.onCreateUI($parentContainer, $elemCenter);
        $parentContainer.append($elemCenter);

        let $elemInputImg = $('<input type="file" accept="image/*" id="brjs-inputImage">');
        $parentContainer.append($elemInputImg);

        $('#brjs-snap').click(this.snapClick.bind(this));
        $('#brjs-finish').click(this.finishClick.bind(this));
        $('#brjs-btnSecondaryAction').click(this.onBtnSecondaryActionClick.bind(this));
        $('#brjs-gum').on('loadedmetadata', this.streamLoadedMetadata.bind(this));
        $('#brjs-inputImage').on("change", this.staticImgChange.bind(this));
    },

    streamLoadedMetadata: function() {
        this.showDebugInfo('method', 'streamLoadedMetadata');

        this.gumVideo.style.height = ($(window).height() ) + 'px';
        this.gumVideo.style.width = '100%';

        this.onStreamLoadedMetadata();
    },

    staticImgChange: function() {
        this.showDebugInfo('method', 'staticImgChange');

        let image = document.getElementById('brjs-imgStatic');
        image.style.height = ($(window).height() - 5) + 'px';

        this.onstaticImgChange();

        image.onload = function() {
            $('#brjs-imgStatic').css('display', 'initial');
            $('#brjs-gum').hide();

            this.onUserChoseImage();

            let canvas = document.createElement('canvas');
            let canvasContext = canvas.getContext('2d');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;

            canvasContext.drawImage(image, 0, 0, canvas.width, canvas.height);

            let frameQuality = this.getFrameQuality(canvasContext.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            this.showDebugInfo('static img frame quality', frameQuality);
        }.bind(this);

        let reader = new FileReader();
        reader.onload = function (e) {
          $('#brjs-imgStatic').attr('src', e.target.result);
          this.sendImageToScanner(e.target.result);
        }.bind(this);

        reader.readAsDataURL($('#brjs-inputImage')[0].files[0]);
    },

    snapClick: function() {
        this.showDebugInfo('method', 'snapClick');

        if (this.inSelectMode) {
            $('#brjs-inputImage').click();
            return;
        }

        if (this.showAddButton) {
            this.showAddButton = false;

            $('#brjs-gum').show();

            this.onAddScanButtonClicked();

        } else {
            this.showAddButton = true;

            let canvas = document.createElement('canvas');
            let canvasContext = canvas.getContext('2d');
            // canvas.width = this.gumVideo.videoWidth;
            // canvas.height = this.gumVideo.videoHeight;
            canvas.width = this.gumVideo.videoWidth * (100 - (this.cameraCaptureCropPercentLeft + this.cameraCaptureCropPercentRight)) / 100;
            canvas.height = this.gumVideo.videoHeight * (100 - (this.cameraCaptureCropPercentTop + this.cameraCaptureCropPercentBottom)) / 100;

            this.onScanInitiated();

            let winningQuality = 0;
            let winningDataUrl = null;
            let counter = 0;

            let timer = setInterval(function() {
                counter++;

                //canvasContext.drawImage(this.gumVideo, 0, 0, canvas.width, canvas.height);
                canvasContext.drawImage(this.gumVideo, (this.gumVideo.videoWidth * this.cameraCaptureCropPercentLeft / 100), (this.gumVideo.videoHeight * this.cameraCaptureCropPercentTop / 100), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
                let frameQuality = this.getFrameQuality(canvasContext.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);

                if (frameQuality > winningQuality) {
                    winningQuality = frameQuality;
                    winningDataUrl = canvas.toDataURL('image/jpeg');
                }

                if (counter == 5) {
                    clearInterval(timer);
                    this.onScanAcquired(winningDataUrl);
                    this.sendImageToScanner(winningDataUrl);
                }
            }.bind(this), 200);
        }
    },

    finishClick: function() {
        this.showDebugInfo('method', 'finishClick');

        $('#brjs-inputImage').val('');

        if (!this.inSelectMode) {
            window.stream.getTracks().forEach(function(curTrack) {
                curTrack.stop();
            });
        }

        if (this.waitingForScanResults) {
            this.finishPending = true;
            this.onWaitingForScanResults();
            return;
        }

        this.endScan();
    },

    retakeScan: function() {
        this.showDebugInfo('method', 'retakeScan');

        this.parseResults = null;
        this.showAddButton = false;
        this.curFrameIdx--;

        if (this.xhrSendImageToScannerQueue.length) {
            let xhr = this.xhrSendImageToScannerQueue.pop();
            if (xhr.readyState != 4) xhr.abort();
        }

        $('#brjs-imgStatic').hide();
        $('#brjs-gum').show()

        this.onRetakeScan();
    },

    cancelScan: function() {
        this.showDebugInfo('method', 'cancelScan');

        if (!this.inSelectMode) {
            window.stream.getTracks().forEach(function(curTrack) {
                curTrack.stop();
            });
        }

        this.onCancelScan();
        this.clearScan();
    },

    endScan: function() {
        this.showDebugInfo('method', 'endScan');

        this.onEndScan();

        this.returnResults();
    },

    dataURLtoBlob:  function(dataUrl) {
        let parts = dataUrl.split(','), mime = parts[0].match(/:(.*?);/)[1];
        if(parts[0].indexOf('base64') !== -1) {
            let bstr = atob(parts[1]), n = bstr.length, u8arr = new Uint8Array(n);
            while(n--){
                u8arr[n] = bstr.charCodeAt(n);
            }

            return new Blob([u8arr], {type:mime});
        } else {
            let raw = decodeURIComponent(parts[1]);
            return new Blob([raw], {type: mime});
        }
    },

    getFrameQuality: function(rgbaImgData, width, height) {
        const vertScanLineNum = 28;
        const horizScanLineNum = 20;
        let totalStrength = 0;
        let sampleNum = 0;

        let i, distance, row, col;
        let curPixel, prevPixel, nextPixel, lastDiff, currDiff, secondDiff;

        for (i = 0; i < vertScanLineNum; i++) {
          distance = parseInt(width / (vertScanLineNum + 1));
          col = parseInt(distance * i + distance / 2);

          for (row = 1; row < height - 1; row++) {

            curPixel = this.getIntensity(rgbaImgData, row, col, width);
            prevPixel = this.getIntensity(rgbaImgData, row-1, col, width);
            nextPixel = this.getIntensity(rgbaImgData, row+1, col, width);

            lastDiff = prevPixel - curPixel;
            currDiff = curPixel - nextPixel;
            secondDiff = currDiff - lastDiff;
            sampleNum += 1;
            totalStrength += (secondDiff) * (secondDiff);
          }
        }

        for (i = 0; i < horizScanLineNum; i++) {
          distance = parseInt(height / (horizScanLineNum + 1));
          row = parseInt(distance * i + distance / 2);

          for (col = 1; col < width - 1; col++) {

            curPixel = this.getIntensity(rgbaImgData, row, col, width);
            prevPixel = this.getIntensity(rgbaImgData, row, col-1, width);
            nextPixel = this.getIntensity(rgbaImgData, row, col+1, width);

            lastDiff = prevPixel - curPixel;
            currDiff = curPixel - nextPixel;
            secondDiff = currDiff - lastDiff;
            sampleNum += 1;
            totalStrength += (secondDiff) * (secondDiff);
          }
        }

        let res = totalStrength / sampleNum;
        let qratio = parseFloat(width * height) / (640.0 * 480.0);

        if (qratio > 1.0) {
          if (qratio > 10.0) qratio = 10.0;
          res /= qratio;
        } else {
          res *= qratio;
        }

        return res;
    },

    getIntensity: function(rgbaImgData, row, col, width) {
        let baseIdx = ((row * width) + col) * 4;

        let r = rgbaImgData[baseIdx];
        let g = rgbaImgData[baseIdx+1];
        let b = rgbaImgData[baseIdx+2];

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    },

    sendImageToScanner: function(dataUrl) {
        this.showDebugInfo('method', 'sendImageToScanner');

        let data = new FormData();

        if (this.blinkReceiptId !== null) {
            data.append('blink_receipt_id', this.blinkReceiptId);
        }

        data.append('frame_idx', this.curFrameIdx++);
        data.append('license_key', this.apiKey);
        data.append('country', this.countryCode);
        data.append('mobile_web', true);
        data.append('detect_duplicates', this.detectDuplicates);

        if (this.validatePromotions) {
            data.append('validate_promotions', 1);

            if (this.promotionIds) {
                data.append('promo_slug', this.promotionIds[0]);
                data.append('promo_slugs', this.promotionIds.join(','));
            }
        }

        if (this.clientUserId.length > 0) {
            data.append('client_user_id', this.clientUserId);
        }

        let blob = this.dataURLtoBlob(dataUrl);

        data.append('image', blob);

        this.frames.push(blob);

        if (this.linuxArgs !== null) {
            for (let field in this.linuxArgs) {
                data.append(field, this.linuxArgs[field]);
            }
        }

        this.waitingForScanResults = true;

        let xhr = $.post({
            url: "https://" + this.apiDomain + "/api_scan" + (this.apiVersion === null ? '' : '/v' + this.apiVersion),
            data: data,
            cache: false,
            contentType: false,
            processData: false,
            dataType: "text",
            success: function(respText, textStatus, request) {
                this.hash = request.getResponseHeader("X-BlinkReceipt-Hash");
                this.rawResponse = respText;

                let resp = JSON.parse(respText);

                if (resp.error) {
                    this.onStreamCaptureError(BlinkReceiptError.SCANFAIL, resp.error);

                } else if (resp.blur_score) {
                    this.curFrameIdx--;
                    this.onStreamCaptureError(BlinkReceiptError.BLURRYFRAME, "Frame too blurry");
                
                } else {
                    this.parseResults = resp;

                    this.onPreliminaryResults(this.parseResults);

                    if (this.blinkReceiptId === null) {
                        this.blinkReceiptId = this.parseResults.blink_receipt_id;
                    }
                }

                this.waitingForScanResults = false;

                if (this.finishPending) {
                    $('#brjs-imgSpinner').hide();
                    this.endScan();
                }
            }.bind(this),
            error: function(xhr, status, error) {
                if (status !== 'abort') {
                    this.onStreamCaptureError(BlinkReceiptError.SCANFAIL, 'Failed to scan image: ' + error);
                }
                if (status === 'timeout') {
                    this.framesTimedOut++;
                }
            }.bind(this)
        });

        this.xhrSendImageToScannerQueue.push(xhr);
    },

    returnResults: function() {
        this.showDebugInfo('method', 'returnResults');

        this.onFinished(this.parseResults, this.rawResponse, this.hash);
        if (this.parseResults) this.postDataToServer();
    },

    postDataToServer: function() {
        let paymentMethodStr = '';

        if (this.parseResults.paymentMethods) {
            this.parseResults.paymentMethods.forEach(function(pmt) {
                paymentMethodStr += pmt.method.value + ',';
            });
            paymentMethodStr = paymentMethodStr.substr(0,paymentMethodStr.length-1);
        }

        let dateStr = '';
        let timeStr = '';
        if (this.parseResults.date) {
            let dateComponents = this.parseResults.date.value.split('/');
            dateStr = dateComponents[1] + '-' + dateComponents[0] + '-' + dateComponents[2];

            if (this.parseResults.time) {
                timeStr = dateStr + 'T' + this.parseResults.time.value + ':00-0400';
            }

        }

        let currentDate = new Date();
        let sessionEndTime = currentDate.getTime() / 1000;
        let sessionLength = sessionEndTime - this.sessionStartTime;

        const data = {
            receipt: {
                banner_id: this.parseResults.banner_id,
                purchased_date: dateStr,
                purchased_time: timeStr,
                store_location_number: this.parseResults.store ? this.parseResults.store.value : '',
                phone_number: this.parseResults.phones ? this.parseResults.phones[0].value : '',
                payment_method: paymentMethodStr,
                transaction_id: this.parseResults.transaction ? this.parseResults.transaction.value : '',
                cashier_id: this.parseResults.cashier ? this.parseResults.cashier.value : '',
                register_id: this.parseResults.register ? this.parseResults.register.value : '',
                product_count: this.parseResults.products ? this.parseResults.products.length : 0,
                subtotal : this.parseResults.subtotal ? this.parseResults.subtotal.value : -1,
                taxes : this.parseResults.taxes ? this.parseResults.taxes.value : -1,
                total : this.parseResults.total ? this.parseResults.total.value : -1,
                frame_count: this.frames.length,
                frames_timed_out: this.framesTimedOut,
                session_length: sessionLength,
                blink_receipt_id: this.blinkReceiptId,
                sdk_version: this.sdkVersion,
                merchant_name: this.parseResults.merchant_name ? this.parseResults.merchant_name : '',
                address: this.parseResults.store_street ? this.parseResults.store_street.value : '',
                city: this.parseResults.store_city ? this.parseResults.store_city.value : '',
                state: this.parseResults.store_state ? this.parseResults.store_state.value : '',
                zip_code: this.parseResults.store_zip ? this.parseResults.store_zip.value : '',
                country_code: this.countryCode,
                api_key: this.apiKey
            }
        };

        if (this.parseResults.qualifiedPromoDbId) {
            data.receipt.promotion_ids = [this.parseResults.qualifiedPromoDbId];
        }

        if (this.parseResults.products) {
            data.products = [];

            this.parseResults.products.forEach(function(curProd) {
                data.products.push({id: 'null',
                                    receipt_product_number: curProd.rpn ? curProd.rpn.value : '',
                                    purchased_price: curProd.totalPrice ? curProd.totalPrice.value : 0,
                                    regular_price : curProd.fullPrice ? curProd.fullPrice.value : 0,
                                    receipt_short_description: curProd.rsd ? curProd.rsd.value : '',
                                    quantity: curProd.qty ? curProd.qty.value : 1,
                                    unit_of_measure: curProd.uom ? curProd.uom.value : '',
                                    unit_quantity: curProd.uom_amount ? curProd.uom_amount.value : 1,
                                    unit_price: curProd.price ? curProd.price.value : 0,
                                    brand: curProd.brand ? curProd.brand : '',
                                    product_name: curProd.product_name ? curProd.product_name : '',
                                    category: curProd.category ? curProd.category : '',
                                    size: curProd.size ? curProd.size : '',
                                    upc: curProd.upc ? curProd.upc : '',
                                    image_url: curProd.image_url ? curProd.image_url : '',
                                    fetch_rewards_group: curProd.rewards_group ? curProd.rewards_group : '',
                                    fetch_competitor_rewards_group: curProd.competitor_rewards_group ? curProd.competitor_rewards_group : ''
                                    });
            });
        }

        $.post({
            url: "https://licensing.blinkreceipt.com/api/receipts",
            data: data,
            cache: false,
            headers: {"Accept": "application/vnd.windfall+json;version=1",
                      "uid": 1,
                      "Api-Token": "KDzmRrzfy9TzZscnBan9"},

            success: function(resp){
                if (resp.success) {
                    this.postImagesToServer();
                }
            }.bind(this),

            error: function(xhr, status, error) {
                console.log('post error: ' + status + ' error ' + error);
            }.bind(this)
        });
    },

    postImagesToServer: function() {
        this.frames.forEach(function(curFrame, idx) {
            let data = new FormData();

            data.append('receipt_images[blink_receipt_id]', this.blinkReceiptId);
            data.append('receipt_images[index]', idx+1);

            data.append('receipt_images[image]', curFrame, 'test.png');

            $.post({
                url: "https://licensing.blinkreceipt.com/api/receipt_images",
                data: data,
                cache: false,
                headers: {"Accept": "application/vnd.windfall+json;version=1",
                      "uid": 1,
                      "Api-Token": "KDzmRrzfy9TzZscnBan9"},
                contentType: false,
                processData: false,
                success: function(resp){
                    
                }.bind(this),
                error: function(xhr, status, error) {
                    
                }.bind(this)
            });
        }, this);
    },

    uuidv4: function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
};

$.ajaxSetup({
    timeout: 15000,
});

$(document).ready(function() {
    BlinkReceipt.createUI();
});

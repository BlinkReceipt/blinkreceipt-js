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
    clientUserId: null,

    /**
     * This callback is invoked once the user has indicated the scanning session is complete
     * @param parseResults {object} For the structure of the results object consult the response schema in the API docs at {@link https://app.swaggerhub.com/apis-docs/blinkreceipt/apiscan}
     * @param jsonString {string} This is the raw JSON string on which the hash was computed
     * @param hash {string} This is the SHA-256 HMAC hash computed on the `jsonString` using your client secret as the key
     */
    onFinished: function(parseResults, jsonString, hash) {

    },

    /**
     * This callback is invoked once per scanned frame, as soon as results are ready. The results will be aggregated for all frames scanned up to this point.
     * @param parseResults {object} For the structure of the results object consult the response schema in the API docs at {@link https://app.swaggerhub.com/apis-docs/blinkreceipt/apiscan}
     */
    onPreliminaryResults: function(parseResults) {

    },

    /**
     * This callback is invoked if the user cancels out of the scanning session
     */
    onCancelled: function() {

    },

    /**
     * This callback is invoked in static scanning mode once the user has selected an image
     */
    onUserChoseImage: function() {

    },

    /**
     * This callback is invoked if an error occurs during the scanning session
     * @param errorCode {BlinkReceiptError} The code indicating what type of error occurred
     * @param msg {string} Additional information about the error
     */
    onError: function(errorCode, msg) {

    },

    oldBgColor: null,
    gumVideo: null,
    audio: null,
    showAddButton: false,
    inSelectMode: false,
    piLookupInProgress: false,
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

    /**
     * Initiate a live scanning session
     */
    startMobileScan: function() {
        let isSecureOrigin = location.protocol === 'https:' || location.hostname === 'localhost';
        if (!isSecureOrigin) {
            this.onError(BlinkReceiptError.INSECURE, 'getUserMedia() must be run from a secure origin: HTTPS or localhost.');
            return;
        }

        this.oldBgColor = $('body').css('backgroundColor');
        $('body').css('backgroundColor', 'black');

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

        //this.blinkReceiptId = this.uuidv4();

        let currentDate = new Date();
        this.sessionStartTime = currentDate.getTime() / 1000;
    },

    /**
     * Initiate a static scanning session
     */
    startStaticScan: function() {
        this.inSelectMode = true;
        $('#inputImage').click();
        $('#snap').removeClass('cameraButton').addClass('plusButton');

        if ($(window).width() > 500) {
            $('#tblButtons').css('position', 'relative');
        }

        //this.blinkReceiptId = this.uuidv4();

        let currentDate = new Date();
        this.sessionStartTime = currentDate.getTime() / 1000;
    },

    /**
     * Reset state to prepare for a new scan (not required for 1st scan)
     */
    clearScan: function() {
        this.parseResults = null;
        this.curFrameIdx = 1;
        this.blinkReceiptId = null;
        this.piLookupInProgress = false;
        this.showAddButton = false;
        this.inSelectMode = false;
        this.staticImages = [];

        $('#br-container').css('display', '');
        $('#gum').css('display', '');
        $('#snap').removeClass('plusButton').addClass('cameraButton');
        $('#imgStatic').css('display', 'none');
        $('#finish').css('visibility', 'hidden');
        $('#btnLeftAction').css('visibility', 'hidden');
        $('#snap').css('visibility', 'hidden');
    },

    handleStreamCaptureSuccess: function(stream) {
            //console.log('getUserMedia() got stream: ', stream);
            window.stream = stream;
            this.gumVideo.style.display = '';
            this.gumVideo.srcObject = stream;

            $('#start').prop('disabled',true);
            $('#snap').prop('disabled', false);
            $('#stop').prop('disabled', false);
    },

    handleStreamCaptureError: function(error) {
        //console.log('navigator.getUserMedia error: ', error);
        this.onError(BlinkReceiptError.STREAMFAIL, 'Failure to get stream: ' + error);
    },

    createUI: function() {
        let elemVideo = $('<video id="gum" autoplay muted playsinline style="display: none"></video>');
        $('#br-container').append(elemVideo);

        let elemEdge1 = $('<span class="edgeLabel">Receipt Edge</span>')
                        .css({top: $(window).height() / 2 + 'px',
                            left: '0px',
                            display: ''})
                        .css('-webkit-transform', 'translate(-35%, 0) rotate(-90deg)');
        $('#br-container').append(elemEdge1);

        let elemEdge2 = $('<span class="edgeLabel">Receipt Edge</span>')
                        .css({top: $(window).height() / 2 + 'px',
                            right: '0px',
                            display: ''})
                        .css('-webkit-transform', 'translate(35%, 0) rotate(90deg)');
        $('#br-container').append(elemEdge2);

        let elemCenter = $('<center>');
        let elemImgStatic = $('<img id="imgStatic">');
        elemCenter.append(elemImgStatic);

        let elemDivButtonBar = $('<div id="divButtonBar">');
        let elemTableButtons = $('<table border=0 width=100% id="tblButtons">');

        let elemRowButtons = $('<tbody><tr><td align="center"><button id="btnLeftAction" class="actionButton">Cancel</button></td><td align="center"><button id="snap" class="cameraButton"></button></td><td align="center"><button id="finish" class="actionButton">Finish</button></td></tr></tbody>');


        elemTableButtons.append(elemRowButtons);
        elemDivButtonBar.append(elemTableButtons);
        elemCenter.append(elemDivButtonBar);

        $('#br-container').append(elemCenter);

        let elemInputImg = $('<input type="file" accept="image/*;capture=camera" id="inputImage">');
        $('#br-container').append(elemInputImg);

        let elemSpinner = $('<div id="imgSpinner" src="" style="position: absolute; width: 100px; height: 100px; display: none;">');
        elemSpinner.css({left: (($(window).width() - elemSpinner.width()) / 2) + 'px',
                         top:  (($(window).height() - elemSpinner.height()) / 2) + 'px'});

        $('#br-container').append(elemSpinner);

        this.gumVideo = document.querySelector('video#gum');

        $('#snap').click(this.snapClick.bind(this));
        $('#finish').click(this.finishClick.bind(this));
        $('#btnLeftAction').click(this.btnLeftClick.bind(this));

        $('#gum').on('loadedmetadata', this.loadedMetadata.bind(this));
        $('#inputImage').on("change", this.staticImgChange.bind(this));

        this.audio = new Audio(baseURL + 'media/camera.wav');
    },

    loadedMetadata: function() {
        this.gumVideo.style.height = ($(window).height() ) + 'px';
        this.gumVideo.style.width = '100%';

        $('#tblButtons').css('top', ($(window).height() - $('#tblButtons').height()) + 'px');

        $('#snap').css('visibility', 'visible');
        $('#btnLeftAction').css('visibility', 'visible');
        $('#btnLeftAction').text('Cancel');
    },

    staticImgChange: function() {
        this.onUserChoseImage();

        let image =  document.getElementById('imgStatic');
        image.style.height = ($(window).height() - 5) + 'px';

        image.onload = function() {
            $('#imgStatic').css('display', 'initial');
            $('#gum').css('display', 'none');
            $('#finish').css('visibility', 'visible');
            
            $('#snap').css('visibility', 'visible');
            $('#btnLeftAction').css('visibility', 'visible');
            $('#btnLeftAction').text('Cancel');
            
            if ($(window).width() > 500) {
                $('#divButtonBar').css('width', $('#imgStatic').width() + 'px');
                $('#tblButtons').css('top', 0-$('#tblButtons').height() + 'px');
            } else {
                $('#divButtonBar').css('width', '100%');
                $('#tblButtons').css('top', ($(window).height() - $('#tblButtons').height()) + 'px');
            }

            let canvas = document.createElement('canvas');
            let canvasContext = canvas.getContext('2d');

            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;

            canvasContext.drawImage(image, 0, 0, canvas.width, canvas.height);

            let imData = canvasContext.getImageData(0, 0, canvas.width, canvas.height).data;

            let frameQuality = this.getFrameQuality(imData, canvas.width, canvas.height);

            console.log('static img frame quality: ' + frameQuality);
        }.bind(this);

        let reader = new FileReader();
        reader.onload = function (e) {
          $('#imgStatic').attr('src', e.target.result);
          this.sendImageToScanner(e.target.result);
        }.bind(this);

        reader.readAsDataURL($('#inputImage')[0].files[0]);
    },

    snapClick: function() {
        if (this.inSelectMode) {
            $('#inputImage').click();
            return;
        }

        if (this.showAddButton) {
            this.showAddButton = false;

            //if we have a previous static image, detach and re-insert it below current image so that current image will appear on top
            if (this.staticImages.length > 1) {
                let prevImg = this.staticImages[this.staticImages.length-2];
                prevImg.detach().prependTo($('#br-container'));
            }

            if (this.staticImages.length > 0) {
                let curImg = this.staticImages[this.staticImages.length-1];
                curImg.animate({
                    top: "-=" + curImg.height() * 0.9
                });
            }

            $('#gum').css('display', '');
            $('#finish').css('visibility', 'hidden');
            $('#snap').removeClass('plusButton').addClass('cameraButton');
            $('#btnLeftAction').text('Cancel');

        } else {
            this.showAddButton = true;

            let canvas = document.createElement('canvas');
            let canvasContext = canvas.getContext('2d');

            canvas.width = this.gumVideo.videoWidth;
            canvas.height = this.gumVideo.videoHeight;

            let counter = 0;

            let winningQuality = 0;
            let winningDataUrl = null;

            $('#imgSpinner').css('display', '');

            this.audio.play();

            let timer = setInterval(function() {
                counter++;

                canvasContext.drawImage(this.gumVideo, 0, 0, canvas.width, canvas.height);

                let imData = canvasContext.getImageData(0, 0, canvas.width, canvas.height).data;

                let frameQuality = this.getFrameQuality(imData, canvas.width, canvas.height);

                //console.log("Finished frame " + counter + " with quality " + frameQuality + " and time is " + Date.now());

                if (frameQuality > winningQuality) {
                    winningQuality = frameQuality;
                    winningDataUrl = canvas.toDataURL('image/jpeg');
                }

                if (counter == 5) {
                    clearInterval(timer);
            
                    $('#imgSpinner').css('display', 'none');

                    let scaleW = $('#gum').width() / this.gumVideo.videoWidth;
                    let scaleH = $('#gum').height() / this.gumVideo.videoHeight;

                    let scaleFactor = Math.min(scaleW, scaleH);

                    let imgStatic = $('<img style="position: absolute; display: none">');
                    imgStatic.css('width', scaleFactor * this.gumVideo.videoWidth + 'px');
                    imgStatic.css('height', scaleFactor * this.gumVideo.videoHeight + 'px');
                    imgStatic.css('left', (screen.width - scaleFactor * this.gumVideo.videoWidth) / 2 + "px");
                    imgStatic.css('top', '0px');

                    $('#br-container').prepend(imgStatic);

                    imgStatic.on('load', function() {
                        imgStatic.css('display', '');
                        $('#gum').css('display', 'none');
                        $('#finish').css('visibility', 'visible');
                        $('#btnLeftAction').css('visibility', 'visible');
                        $('#btnLeftAction').text('Retake');
                        $('#snap').removeClass('cameraButton').addClass('plusButton');
                    });
                    
                    imgStatic.get(0).setAttribute('src', winningDataUrl);

                    this.staticImages.push(imgStatic);
                    
                    this.sendImageToScanner(winningDataUrl);
                }
            }.bind(this), 200);
        }
    },

    finishClick: function() {
        $('#inputImage').val('');

        if (!this.inSelectMode) {
            window.stream.getTracks().forEach(function(curTrack) {
                curTrack.stop();
            });
        }

        if (this.piLookupInProgress) {
            $('#imgSpinner').css('display', '');
            this.finishPending = true;
            return;
        }

        this.endScan();
    },

    btnLeftClick: function() {
        if ($('#btnLeftAction').text() == 'Retake') {

            if (this.staticImages.length > 0) {
                let lastImg = this.staticImages.pop();
                lastImg.remove();
            }

            this.showAddButton = false;

            $('#imgStatic').css('display', 'none');
            $('#gum').css('display', '');
            $('#finish').css('visibility', 'hidden');
            $('#btnLeftAction').text('Cancel');
            $('#snap').removeClass('plusButton').addClass('cameraButton');
            
            this.curFrameIdx--;
        
        } else {
            this.cancelScan();

            $('body').css('backgroundColor', this.oldBgColor);
            $('#br-container').css('display', 'none');
        }
    },

    cancelScan: function() {
        if (!this.inSelectMode) {
            window.stream.getTracks().forEach(function(curTrack) {
                curTrack.stop();
            });
        }

        this.staticImages.forEach(function(curStaticImg) {
            curStaticImg.remove();
        });

        this.staticImages = [];

        this.onCancelled();
    },

    endScan: function() {
        this.staticImages.forEach(function(curStaticImg) {
            curStaticImg.remove();
        });

        this.staticImages = [];
                
        $('body').css('backgroundColor', this.oldBgColor);
        $('#br-container').css('display', 'none');

        this.returnResults();
    },

    dataURLtoBlob:  function(dataurl) {
        let parts = dataurl.split(','), mime = parts[0].match(/:(.*?);/)[1];
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

        if (this.clientUserId) {
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

        this.piLookupInProgress = true;

        $.post({
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
                    this.onError(BlinkReceiptError.SCANFAIL, resp.error);

                } else if (resp.blur_score) {
                    this.curFrameIdx--;
                    this.onError(BlinkReceiptError.BLURRYFRAME, "Frame too blurry");
                
                } else {
                    this.parseResults = resp;

                    this.onPreliminaryResults(this.parseResults);

                    if (this.blinkReceiptId === null) {
                        this.blinkReceiptId = this.parseResults.blink_receipt_id;
                    }
                }

                this.piLookupInProgress = false;

                if (this.finishPending) {
                    $('#imgSpinner').css('display', 'none');
                    this.endScan();
                }
            }.bind(this),
            error: function(xhr, status, error) {
                this.onError(BlinkReceiptError.SCANFAIL, 'Failed to scan image: ' + error);
                if (status === 'timeout') {
                    this.framesTimedOut++;
                }
            }.bind(this)
        });
    },

    returnResults: function() {
        this.onFinished(this.parseResults, this.rawResponse, this.hash);
        this.postDataToServer();
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

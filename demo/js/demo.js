$(document).ready(function() {
    if ($(window).width() > 500) {
        $('#resultsContainer').css('width', '500px');
    } else {
        $('#resultsContainer').css('width', '100%');
    }

    if (!BlinkReceipt.isSecureOrigin()) {
        alert('getUserMedia() must be run from a secure origin: HTTPS or localhost.');
    }
    if (isMobileBrowser() && navigator.mediaDevices) {
        $('#btnMobileScan').css('display','');
    }

    $('#initialChoice').css('top', ($(window).height() - $('#initialChoice').height()) / 2 + 'px');
});

//BlinkReceipt.apiKey = '9b21415cd442f62123b6f94a10942a88';
//BlinkReceipt.apiKey = '42aa8cae13104d95b5a7972b11c7b6c6';
BlinkReceipt.apiKey = 'a77a9513e5c78074c62f205fe94e3c34';

BlinkReceipt.debugMode = true;  // descriptive info in console


var parentStub = new Object();  // so that we can copy some of the original methods to be called later in our custom callbacks
parentStub['onUserChoseImage'] = BlinkReceipt['onUserChoseImage'];

BlinkReceipt.onUserChoseImage = function() {
    BlinkReceipt.showDebugInfo('method', 'onUserChoseImage');

    $('#initialChoice').css('display','none');

    parentStub.onUserChoseImage();
};

BlinkReceipt.onPreliminaryResults = function(parseResults) {
    BlinkReceipt.showDebugInfo('method', 'onPreliminaryResults');
    console.log("Got frame results");
}

BlinkReceipt.onFinished = function(parseResults, rawText, hash) {
    BlinkReceipt.showDebugInfo('method', 'onFinished');
    console.log("Got raw text with len " + rawText.length + " and hash " + hash);

    $('body').css('backgroundColor', BlinkReceipt.oldBgColor);
    $('#brjs-container').hide();
    
    var matchProd = null;
    if (typeof brand !== 'undefined') {
        hardcodedProds.forEach(function(curProd) {
            if (curProd.id == brand) {
                matchProd = curProd;
            }
        });
    }

    if (matchProd != null) {
        showProd(matchProd);
    } else {
        if (parseResults) $('.lnkGoBack.bottom').show(); else $('.lnkGoBack.bottom').hide();
        showProdTable(parseResults);

        $('#divJsonRes').css('display','');
    }
    $('#resultsContainer').show();
    $('body')[0].scrollIntoView(true);
};

BlinkReceipt.onStreamCaptureError = function(errorCode, msg) {
    BlinkReceipt.showDebugInfo('method', 'onStreamCaptureError')
    $('#resultsContainer').hide();
    alert("BlinkReceipt error: " + msg);
};

BlinkReceipt.onCancelScan = function() {
    BlinkReceipt.showDebugInfo('method', 'onCancelScan');

    BlinkReceipt.staticImages.forEach(function(curStaticImg) {
        curStaticImg.remove();
    });
    BlinkReceipt.staticImages = [];

    $('body').css('backgroundColor', BlinkReceipt.oldBgColor);
    $('#brjs-tblButtons').css({position:'', left:''});  // these are set only for mobile scan, so we clear them
    $('#initialChoice').show();
};


//Only set these properties if you want to force the sandbox environment and/or a specific version of the API
BlinkReceipt.apiDomain = 'sandbox.blinkreceipt.com';
// BlinkReceipt.apiDomain = 'scan-ph.blinkreceipt.com';
//BlinkReceipt.apiVersion = 9;

var slug = getUrlParameter('slug');
if (slug && slug.length > 0) {
    BlinkReceipt.validatePromotions = true;
    BlinkReceipt.promotionIds = [slug];
}
var apiKey = getUrlParameter('api_key');
if (apiKey && apiKey.length > 0) {
    BlinkReceipt.apiKey = apiKey;
}

$('#btnMobileScan').click(function() {
    $('#initialChoice').css('display','none');
    BlinkReceipt.startMobileScan();
});

$('#btnSelectImage').click(function() {
    BlinkReceipt.startStaticScan();
});

$('.lnkGoBack').click(function(event) {
    event.preventDefault();

    BlinkReceipt.clearScan();

    $('#divJsonRes').hide();
    $('#initialChoice').show();

    $('#tblProds tr').not('.protoRow').remove();

    $('#spanMerchant').css('display','none');
    $('#spanAddress').css('display','none');
    $('#spanCSZ').css('display','none');
    $('#spanPhone').css('display','none');
    $('#cellDate').text('');
    $('#cellTime').text('');
    $('#cellSubtotal').text('');
    $('#cellTaxes').text('');
    $('#cellTotal').text('');
});

function showProdTable(parseResults) {
    $('#loading').css('display','none');

    if (!parseResults) return;

    var qualifiedProdIndexes = [];

    var promoText = '';

    if (parseResults.qualifiedPromos) {

        var qualifiedSlugs = [];

        parseResults.qualifiedPromos.forEach(function(promo) {
            qualifiedSlugs.push(promo.slug);

            if (promo.relatedProductIndexes) {
                promo.relatedProductIndexes.forEach(function(prodIdx) {
                    qualifiedProdIndexes.push(prodIdx);
                });
            }
        });

        promoText += 'Qualified: ' + qualifiedSlugs.join(', ') + '<br>';
    }

    if (parseResults.unqualifiedPromos) {
        var unqualifiedSlugs = [];

        parseResults.unqualifiedPromos.forEach(function(promo) {
            unqualifiedSlugs.push(promo.slug + ': ' + promo.errorMessage + '<br>');

        });

        promoText += 'Not qualified: <br>' + unqualifiedSlugs.join(', ') + '<br>';
    }

    if (promoText.length > 0) {
        $('#spanPromo').html(promoText + '<br>').show();
    }

    if (parseResults.merchant_name) {
        $('#spanMerchant').html(parseResults.merchant_name).css('display','');
    }
    if (parseResults.store_street) {
        $('#spanAddress').html('<br>' + parseResults.store_street.value).css('display','');
    }
    var cityStateZip = '';
    if (parseResults.store_city) {
        cityStateZip = parseResults.store_city.value;
    }
    if (parseResults.store_state) {
        if (cityStateZip.length > 0) cityStateZip += ', ';
        cityStateZip += parseResults.store_state.value;
    }
    if (parseResults.store_zip) {
        if (cityStateZip.length > 0) cityStateZip += ' ';
        cityStateZip += parseResults.store_zip.value;
    }
    if (cityStateZip.length > 0) {
        $('#spanCSZ').html('<br>' + cityStateZip).css('display','');
    }
    if (parseResults.phones) {
        $('#spanPhone').html('<br>' + parseResults.phones[0].value).css('display','');
    }

    if (parseResults.date) {
        var dateObj = new Date(parseResults.date.value);
        var purchaseDate = moment(dateObj.toISOString());
        $('#cellDate').text('Date: ' + purchaseDate.format('MMM D, YYYY'));
    }
    if (parseResults.time) {
        var purchaseTime = moment('2018-01-01 ' + parseResults.time.value);
        $('#cellTime').text('Time: ' + purchaseTime.format('h:mm A'));
    }
    if (parseResults.subtotal) {
        $('#cellSubtotal').text('Subtotal: $' + parseResults.subtotal.value.toFixed(2));
    }
    if (parseResults.taxes) {
        $('#cellTaxes').text('Tax: $' + parseResults.taxes.value.toFixed(2));
    }
    if (parseResults.total) {
        $('#cellTotal').text('Total: $' + parseResults.total.value.toFixed(2));
    }

    if (parseResults.products) {
        for (var i in parseResults.products) {
            var curProd = parseResults.products[i];

            var nameToShow = '';
            if (curProd.rsd && curProd.rsd.value && curProd.rsd.value.length > 0) {
                nameToShow = curProd.rsd.value;
            }
            if (curProd.product_name && curProd.product_name.length > 0) {
                nameToShow = curProd.product_name;
            }

            var newRowTop = $('#protoRowTop').clone().removeClass('protoRow');
            newRowTop.css('display','');
            newRowTop.find('.prodName').text(nameToShow);

            if (qualifiedProdIndexes.indexOf(parseInt(i)) != -1) {
                newRowTop.css('background-color', 'yellow');
            }

            if (curProd.price && curProd.price.value > 0) {
                newRowTop.find('.price').text('$' + curProd.price.value.toFixed(2));
            }

            if (curProd.size && curProd.size.length > 0) {
                newRowTop.find('.size').text(curProd.size);
            }

            if (curProd.image_url && curProd.image_url.length > 0) {
                var imgThumb = newRowTop.find('.imgThumb');
                imgThumb[0].onerror = function() {
                    imgThumb.attr('src', 'nothumb.png');
                };
                
                if (curProd.image_url.substr(0,4) != 'http') {
                    curProd.image_url = 'https://' + curProd.image_url;
                }
                
                imgThumb.attr('src', curProd.image_url);
            }

            newRowTop.appendTo($('#tblProds tbody'));

            var $newRowBottom = $('#protoRowBottom').clone().removeClass('protoRow');
            $newRowBottom.show();

            var extraInfo = [];
            if (curProd.brand && curProd.brand.length > 0) {
                extraInfo.push('Brand: ' + curProd.brand);
            }
            if (curProd.category && curProd.category.length > 0) {
                extraInfo.push('Category: ' + curProd.category);
            }
            if (curProd.upc && curProd.upc.length > 0) {
                extraInfo.push('UPC: ' + curProd.upc);
            }
            if (curProd.rsd && curProd.rsd.length > 0) {
                extraInfo.push('Receipt Text: ' + curProd.rsd.value);
            }
            if (extraInfo.length > 0) {
                $newRowBottom.find('.addlData').html(extraInfo.join('<br>'));
            }

            $newRowBottom.appendTo($('#tblProds tbody'));
        }
    }
}

/**********************************/
/***** FOR MOBILE WALLET DEMO *****/
/**********************************/

function checkForBrandProducts() {
    var searchBrand = brand.toLowerCase();
    if (parseResults.products) {
        for (var i in parseResults.products) {
            var curProd = parseResults.products[i];
            if (curProd.brand) {
                var prodBrand = curProd.brand.toLowerCase();
                if (searchBrand.indexOf(prodBrand) != -1 || prodBrand.indexOf(searchBrand) != -1) {
                    addPointsToBalance(curProd);
                    return;
                }
            }
        }
    }
}

function showProd(matchProd) {
    $('#imgThumb').css({width: '100%'});
    $('#imgThumb').attr('src', matchProd.image_url);
    $('#spanProd').html(firstName + ', thanks for purchasing <b>' + matchProd.product_name + '</b>!<br><br>You\'ve earned 10 loyalty points!');

    $('#prodInfo').css({display: ''});

    addPointsToBalance();
}

function addPointsToBalance() {
    var data = {pass_serial: passSerial};

    $.get({
        url: "https://sandbox.blinkreceipt.com/mobilewallet/passupdate/addbalance.php",
        data: data,
        success: function(resp){
            console.log(resp);
            /*
            var prodBought;
            if (curProd.product_name && curProd.product_name.length > 0) {
                prodBought = curProd.product_name;
            } else {
                prodBought = 'a ' + ucfirst(brand) + ' product';
            }
            alert("Hi " + firstName + "! Thanks for buying " + prodBought + ". You just earned 10 " + ucfirst(brand) + " loyalty points!");
            */
        },
        error: function(xhr, status, error) {
            console.log('addbalance failure: ' + status + ' ' + error);
        }
    });
}

function ucfirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function isMobileBrowser() {
    return (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent)
        || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(navigator.userAgent.substr(0,4)));
}

function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

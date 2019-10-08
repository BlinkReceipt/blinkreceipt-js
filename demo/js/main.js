$(document).ready(function() {
    if ($(window).width() > 500) {
        $('#resultsContainer').css('width', '500px');
    } else {
        $('#resultsContainer').css('width', '100%');
    }
    
    if (navigator.mediaDevices && isMobileBrowser()) {
        $('#btnMobileScan').css('display','');
    }

    $('#initialChoice').css('top', ($(window).height() - $('#initialChoice').height()) / 2 + 'px');
});

function isMobileBrowser() {
    if( navigator.userAgent.match(/Android/i)
     || navigator.userAgent.match(/iPhone/i)
     || navigator.userAgent.match(/iPad/i)
     || navigator.userAgent.match(/iPod/i)) {
        return true;
    }
    return false;
}

//BlinkReceipt.apiKey = '9b21415cd442f62123b6f94a10942a88';
//BlinkReceipt.apiKey = '42aa8cae13104d95b5a7972b11c7b6c6';
BlinkReceipt.apiKey = 'a77a9513e5c78074c62f205fe94e3c34';

BlinkReceipt.onPreliminaryResults = function(parseResults) {
    console.log("Got frame results");
}

BlinkReceipt.onFinished = function(parseResults, rawText, hash) {
    console.log("Got raw text with len " + rawText.length + " and hash " + hash);
    
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
        showProdTable(parseResults);

        $('#divJsonRes').css('display','');
    }
};

BlinkReceipt.onError = function(errorCode, msg) {
    alert("BlinkReceipt error: " + msg);
};

BlinkReceipt.onCancelled = function() {
    BlinkReceipt.clearScan();
    
    $('#initialChoice').css('display', '');
};

//Only set these properties if you want to force the sandbox environment and/or a specific version of the API
BlinkReceipt.apiDomain = 'sandbox.blinkreceipt.com';
//BlinkReceipt.apiVersion = 9;

var queryParams = new URLSearchParams(window.location.search);
var slug = queryParams.get('slug');
if (slug && slug.length > 0) {
    BlinkReceipt.validatePromotions = true;
    BlinkReceipt.promotionIds = [slug];
}
var apiKey = queryParams.get('api_key');
if (apiKey && apiKey.length > 0) {
    BlinkReceipt.apiKey = apiKey;
}

$('#btnMobileScan').click(function() {
    $('#initialChoice').css('display','none');
    BlinkReceipt.startMobileScan();
});

$('#btnSelectImage').click(function() {
    BlinkReceipt.onUserChoseImage = function() {
        $('#initialChoice').css('display','none');
    };
    BlinkReceipt.startStaticScan();
});



$('#lnkGoBack').click(function(event) {
    event.preventDefault();

    BlinkReceipt.clearScan();

    $('#divJsonRes').css('display', 'none');
    $('#initialChoice').css('display', '');

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
        $('#spanPromo').html(promoText + '<br>').css('display', '');
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
        let dateObj = new Date(parseResults.date.value);
        let purchaseDate = moment(dateObj.toISOString());
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

            var newRowBottom = $('#protoRowBottom').clone().removeClass('protoRow');
            newRowBottom.css('display', '');

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
                newRowBottom.find('.addlData').html(extraInfo.join('<br>'));
            }

            newRowBottom.appendTo($('#tblProds tbody'));
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



<!DOCTYPE html>
<!--
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
-->
<html>
<head>

  <meta charset="utf-8">
  <meta name="description" content="WebRTC code samples">
  <meta name="viewport" content="width=device-width, user-scalable=yes, initial-scale=1, maximum-scale=1">
  <meta itemprop="description" content="Client-side WebRTC code samples">
  <meta itemprop="name" content="WebRTC code samples">
  <meta name="mobile-web-app-capable" content="yes">
  <meta id="theme-color" name="theme-color" content="#ffffff">

  <base target="_blank">

  <title>BlinkReceipt Mobile Web Demo</title>

  <link href="//fonts.googleapis.com/css?family=Roboto:300,400,500,700" rel="stylesheet" type="text/css">
  <?php

  //$mtime = filemtime('js/main.css');
  //echo '<link rel="stylesheet" href="css/main.css?cb=' . $mtime . '">';

  ?>

  <?php

  if (!empty($_GET['serial'])) {
      require_once '../passupdate/realdb.php';

      $passSerial = $_GET['serial'];
      $passInfo = getInfoForPass($passSerial);
      echo "<script>";
      echo "var passSerial = '{$passSerial}';\n";
      echo "var brand = '{$passInfo['brand']}';\n";
      echo "var firstName = '{$passInfo['first_name']}';\n";
      echo "</script>";
  }

  ?>

  <script>
  function onOpenCvReady() {
    var span = document.getElementById('opencvspan');
    span.innerText = "OpenCV Ready";
  }
  </script>
  <!--
  <script async src="opencv.js" onload="onOpenCvReady();" type="text/javascript"></script>
  -->
  <script
  src="https://code.jquery.com/jquery-3.1.1.min.js"
  integrity="sha256-hVVnYaiADRTO2PzUGmuLJr8BLUSjGIZsDYGmIJLv2b8="
  crossorigin="anonymous"></script>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.0/moment.min.js"></script>

</head>

<body>
  <div id="initialChoice" style="position: absolute; width: 100%">
  <center>
    <button id="btnSelectImage" style="font-size: 24pt; width: auto">Select Image</button><br><br>
    <button id="btnMobileScan" style="display: none; font-size: 24pt; width: auto">Scan Receipt</button>
  </center>
  </div>

  <div id="br-container">

    <!--<video id="gum" autoplay muted playsinline style="display: none"></video>

    <span style="color: white; position: absolute; display: none; font-family: Arial" id="lblEdge1">Receipt Edge</span>
    <span style="color: white; position: absolute; display: none; font-family: Arial" id="lblEdge2">Receipt Edge</span>

    <center>
    <img id="imgStatic" style="display: none">
    
    <div id="divButtonBar">
    <table border=0 width=100% id="tblButtons" style="position: absolute; left: 0px;">
      <tr>
        <td style="width: 33%" align="center">
          <button id="retake" style="width: 120px; border: none; background-color: black; color: white; font-family: Arial; font-size: 16pt; visibility: hidden; position: relative; top: -10px">Retake</button>
        </td>
        <td style="width: 33%" align="center">
          <button id="snap" style="background-image: url('camera-big.png'); background-size: 60px 60px; width: 60px; height: 60px; border: none; visibility: hidden"></button>
        </td>
        <td style="width: 33%" align="center">    
          <button id="finish" style="width: 100px; height: 60px; border: none; background-color: black; color: white; font-family: Arial; font-size: 16pt; visibility: hidden; ">Finish</button>
        </td>
      </tr>
    </table>
    </div>
    </center>
    <span id="opencvspan"></span>
    <input type="file" accept="image/*;capture=camera" id="inputImage" style="visibility: hidden">
    
    <img src="Spinner-1s-200px.gif" style="position: absolute; z-index: 1000; width: 150px; height: 150px; display: none">
    -->
  </div>

  <table id="prodInfo" style="display: none" border=0 width=100%>
    <tr>
      <td style="width: 33%; background-color: yellow">
        <img id="imgThumb">
      </td>
      <td>
        <span id="spanProd" style="font-family: Arial; font-weight: semibold"></span>
      </td>
    </tr>
  </table>

  <span id="loading" style="display: none">Loading...</span>

  <div id="divJsonRes" style="display: none">
    <a id="lnkGoBack" href=""><img src="back-button.jpg" width=25></a><br>

    <div id="resultsContainer">
      <center style="font-family: Arial">
      <span id="spanPromo" style="display: none"></span>
      <span id="spanMerchant" style="display: none; font-size: 24pt;"></span>
      <span id="spanAddress" style="display: none"></span>
      <span id="spanCSZ" style="display: none"></span>
      <span id="spanPhone" style="display: none"></span>
      </center>
      <br>

      <table border=0 width=100% style="font-family: Arial">
      <tr>
        <td id="cellDate"></td><td id="cellSubtotal" align="right"></td>
      </tr>
      <tr>
        <td id="cellTime"></td><td id="cellTaxes" align="right"></td>
      </tr>
      <tr>
        <td></td><td id="cellTotal" align="right"></td>
      </tr>
      </table>
      <br><br>

      <table id="tblProds" width=100% style="border-collapse: collapse; font-family: Arial">
      <tbody>
        <tr id="protoRowTop" class="protoRow" style="display: none;">
         <td style="width: 25%; padding-top: 5px"><img class="imgThumb" style="width: 100%" src="nothumb.png"></td>
         <td style="padding-left: 15px; padding-right: 15px;"><span class="prodName" style="font-weight: semibold"></span></td>
         <td style="width: 15%"><span class="price" style="font-weight: semibold;"></span>
          <br>
          <span class="size" style="font-weight: semibold; font-size: 10pt"></span> 
          </td>
        </tr>
        <tr id="protoRowBottom" class="protoRow" style="display: none; border-bottom: 1px solid gray;">
          <td colspan=3 style="padding-bottom: 5px"><span class="addlData"></span></td>
        </tr>
        </tbody>
      </table>
    </div>
    
  </div>

  <!-- include adapter for srcObject shim -->
  <script src="https://webrtc.github.io/adapter/adapter-latest.js"></script>
  <script src="js/prods.js?a=1"></script>
  <?php

  $mtime = filemtime('../lib/css/blinkreceipt.css');
  echo '<link rel="stylesheet" href="../lib/css/blinkreceipt.css?cb=' . $mtime . '">';

  $mtime = filemtime('../lib/js/blinkreceipt.js');
  echo '<script src="../lib/js/blinkreceipt.js?cb=' . $mtime . '"></script>';

  $mtime = filemtime('js/main.js');
  echo '<script src="js/main.js?cb=' . $mtime . '"></script>';

  ?>

</body>
</html>

/**
 * CALIBRATOR.JS
 * Created. 2016
 *
 * Screen calibrator boilerplate for web based experiments.
 * 
 * Authors. Albert Buchard, Amanda Yung and Augustin Joessel
 *
 * Requires: lodash.js and jQuery
 * 
 * LICENSE MIT 
 */

/* =============== Set-up =============== */

/* === Get the absolute path of the library === */
var scripts = document.getElementsByTagName("script");
var calibratorFullpath = scripts[scripts.length - 1].src;
var delimiterIndices = findAllIndices("/", calibratorFullpath);
calibratorFullpath = calibratorFullpath.substr(0, delimiterIndices[delimiterIndices.length - 2]);

/* === Add the calibrator css once the page is loaded === */
document.addEventListener("DOMContentLoaded", function (event) {
  var head = document.getElementsByTagName('head')[0];
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = calibratorFullpath + '/css/calibrator.css';
  head.appendChild(link);
});

/* =============== Calibrator Class =============== */

/** A self contained object for easy web based screen calibration */
class Calibrator {
  /**
   * Setup of the calibrator object
   * @param  {function}  callbackWhenClosed function to call when the calibrator is dismissed. 
   * An object containing relevant calibration information is passed as argument.
   * @param  {Boolean} showWhenReady      If true, the calibrator is displayed after templates are loaded.
   * @return {Calibrator}                   
   */
  constructor(callbackWhenClosed = null, showWhenReady = true) {
    /**
     * Check if the full path is known
     */
    if (typeof calibratorFullpath === "undefined") {
      throw new Error("Calibrator.js: library path is unknown.");
    } else {
      this.calibratorFullpath = calibratorFullpath;
    }

    /**
     * Check if underscore.js is loaded
     */

    if (typeof _ !== "function") {
      throw new Error("Calibrator.js: Underscore.js is needed for templating.");
    }

    /**
     * Object containing the file path of all the views
     * @type {Object}
     * @const
     * @private
     */
    this.VIEWS_PATHS = {
      container: this.calibratorFullpath + "/views/calibrator-container.template",
      knownsize: this.calibratorFullpath + "/views/calibrator-s1-knownsize.template",
      enterknownsize: this.calibratorFullpath + "/views/calibrator-s1-enterknownsize.template",
      chooseobject: this.calibratorFullpath + "/views/calibrator-s1-chooseobject.template",
      specifystandardsize: this.calibratorFullpath + "/views/calibrator-s1-specifystandardsize.template",
      setbrightness: this.calibratorFullpath + "/views/calibrator-s2-content.template",
      summary: this.calibratorFullpath + "/views/calibrator-s3-content.template"
    };

    var thisObject = this;
    this.templateManager = new TemplateManager(this.VIEWS_PATHS, function () {
      thisObject.templatesAreLoaded();
    });

    /**
     * Image keys
     * @const
     * @private
     */
    this.IMAGE_KEY_CREDITCARD = "creditCard";
    this.IMAGE_KEY_CD = "cd";

    /**
     * Images object with [path, [width, height], real width in cm, maxScaling]
     * @type {Object}
     * @const
     * @private
     */
    this.IMAGES = {
      [this.IMAGE_KEY_CREDITCARD]: [this.calibratorFullpath + "/img/card.png", [384, 242], 8.6, 1.2],
      [this.IMAGE_KEY_CD]: [this.calibratorFullpath + "/img/cd.png", [596, 596], 12, 1.2]
    };

    /**
     * Distance of the subject from the screen in cm, default to 50 cm (arm length)
     * @type {Number}
     * @const
     * @public
     */
    this.distanceFromScreen = 50;

    /**
     * Heigth of the canvas in pixels
     * @type {Number}
     * @private
     */
    this.canvasHeight = 400;

    /**
     * Number of different gray shades for the brightness calibration 
     * @type {Number}
     * @const
     * @private
     */
    this.BRIGHTNESS_NUMBER_OF_CONTRASTS = 12;

    /**
     * Object storing the cached image to draw on the canvas
     * @type {Object}
     * @private
     */
    this.cachedImages = {};

    /** Preload images */
    this.preloadImages();

    /** 
     * Steps constants 
     * @const
     * @private
     */
    this.STEP_TITLES = ["Step 1: Screen size calibration", "Step 2: Contrast and brightness", "Step 3: Summary"];

    this.STEP_SCREENSIZE_ASK_IFKNOWS = 0;
    this.STEP_SCREENSIZE_ENTER_KNOWNSIZE = 1;
    this.STEP_SCREENSIZE_CHOOSE_OBJECT = 2;
    this.STEP_SCREENSIZE_ENTER_OBJECTSIZE = 3;
    this.STEP_BRIGHTNESS = 4;
    this.STEP_SUMMARY = 5;

    /**
     * Buttons value attributes
     * @const
     * @private
     */
    this.BUTTON_SIZEKNOWN = "s1:sizeKnown";
    this.BUTTON_SIZEUNKNOWN = "s1:sizeUnknown";
    this.BUTTON_CONFIRM_MANUALSIZE = "s1:confirmManualSize";
    this.BUTTON_CHOOSE_CREDITCARD = "s1:chooseCreditCard";
    this.BUTTON_CHOOSE_COMPACTDISK = "s1:chooseCompactDisk";
    this.BUTTON_CONFIRM_OBJECTSIZE = "s1:confirmObjectSize";
    this.BUTTON_CONFIRM_BRIGHTNESS = "s2:confirmBrightness";
    this.BUTTON_FINAL_CONFIRM = "s3:finalConfirm";

    this.BUTTON_BACK = "back";

    this.currentStep = this.STEP_SCREENSIZE_ASK_IFKNOWS;

    /**
     * Desired precision of the text output
     * @type {Number}
     * @const
     * @private
     */
    this.FLOAT_PRECISION = 2;

    /**
     * Private variables
     */

    /**
     * Private variable holding screen real diagonal size in inches
     * @type {Number}
     * @private
     */
    this._diagonalSize = null;

    /**
     * Private variable holding the current image key
     * @type {string}
     * @private
     */
    this._currentImage = null;

    /**
     * Private variable holding the image scale ratio between 0 and 1.
     * @type {Number}
     * @private
     */
    this._imageRatio = 0.5;

    /**
     * Determines if the calibrator automatically shows after loading of templates.
     * @type {boolean}
     * @private
     */
    this._showWhenReady = (showWhenReady === true) ? true : false;

    /** Setup callback */

    /**
     * Function called after the user closes the calibrator. Argument sent to the callback is an object with keys 
     *   * status 
     *     + 0 the calibrator did not finish normally
     *     + 1 calibrator finish normally
     *   * diagonalSize 
     *     + diagonal size in inches
     *   * diagonalSizeInPx
     *     + diagonal size in inches
     *   * distanceFromScreenInCm
     *     + distance from the screen in cm (calibrator.distanceFromScreen)
     *   * pixelsPerInch
     *     + computed pixel density in pixels per inch
     *   * pixelsPerDegree
     *     + computed pixels per degree
     *     
     * @type {function}
     * @public
     */
    this.callbackWhenClosed = null;

    if (!callbackWhenClosed) {
      console.log("Calibrator.js: no callback is set-up for the calibrator to call when finished!");
    } else {
      this.callbackWhenClosed = callbackWhenClosed;
    }

    /** Handle Resize */
    $(window).resize(function () {
      thisObject.canvasResized();
    });

    console.warn("created");
  }

  /**
   * Preloads images from path defined in this.IMAGES
   * @return {undefined}
   * @private
   */
  preloadImages() {
    for (var key in this.IMAGES) {
      this.cachedImages[key] = new Image();
      this.cachedImages[key].src = this.IMAGES[key][0];

      //this.cachedImages[key].onload = function() {
      //   if (++loadedImages >= numImages) {
      //     callback(images);
      //   }
      // };
    }
  }

  /**
   * Called after all templates are loaded and compiled.
   * @return {undefined}
   * @private
   */
  templatesAreLoaded() {
    console.log("Calibrator.js : All templates are loaded");

    /** Add calibrator div to DOM */
    this.addToDom();

    /**
     * Container element reference 
     * @type {object}
     */
    this.container = $(".calibrator-container");

    /** Toggle display depending on preset showWhenReady */
    $(this.container).toggle(this._showWhenReady);

    /** Setup events */
    this.resetEvents();

  }

  /**
   * Adds the calibrator container template to the DOM
   * @private 
   */
  addToDom() {
    this.templateManager.renderInTarget("container", {
      title: this.currentTitle,
      content: this.currentContent
    }, "body");
  }

  /* ======== Appearence Methods ======== */

  /**
   * Shows the calibrator.
   * @return {undefined}
   * @public 
   */
  show() {
    $(this.container).fadeIn(200);
  }

  /**
   * Hides the calibrator.
   * @return {undefined} 
   * @public
   */
  hide() {
    $(this.container).fadeOut(200);
  }

  /**
   * Toggle the display of the calibrator.
   * @return {undefined} 
   * @public
   */
  toggle() {
    $(this.container).toggle(200);
  }

  /**
   * Toggle display of the information div.
   * @return {undefined} 
   * @public
   */
  toggleInfo() {
    $(".calibrator-info-content").toggle(200);
  }

  /* ======== View Update Methods ======== */

  /**
   * Updates the view with the appropriate title and content for the current step.
   * @return {undefined} 
   * @private
   */
  updateView() {
    /** keep reference to current object for the callbacks */
    var thisObject = this;

    /** Update top guide */
    this.updateGuide();

    /**
     * Animate title switch 
     */
    $(".calibrator-title").animate({
      opacity: 0
    }, 300, function () {
      $(".calibrator-title").html("<h3>" + thisObject.currentTitle + "</h3>");
      $(".calibrator-title").animate({
        opacity: 300
      }, 100);
    });

    /**
     * Setup animation of content switch 
     */
    $(".calibrator-content").animate({
      opacity: 0
    }, 300, function () {

      /** Load content */
      $(".calibrator-content").html(thisObject.currentContent);

      /** Perform logic associated with this step */
      thisObject.setStepLogic();

      /** Add back button if necessary */
      if (thisObject.currentStep != thisObject.STEP_SCREENSIZE_ASK_IFKNOWS) {
        thisObject.addBackButton();
      }

      /** Show content div */
      $(".calibrator-content").animate({
        opacity: 300
      }, 100, function () {

        /** Reset events after animation is done and DOM is ready */
        thisObject.resetEvents();

      });
    });

  }

  /**
   * Function that update the classes of the top guide to show active step.
   * @return {undefined} 
   * @private
   */
  updateGuide() {
    if ($(".calibrator-guide").length) {
      _.each($(".calibrator-guide div"), function (element) {
        $(element).removeClass("calibrator-guide-active");
      });

      switch (this.currentStep) {
      case this.STEP_SCREENSIZE_ASK_IFKNOWS:
      case this.STEP_SCREENSIZE_ENTER_KNOWNSIZE:
      case this.STEP_SCREENSIZE_CHOOSE_OBJECT:
      case this.STEP_SCREENSIZE_ENTER_OBJECTSIZE:
        $("#calibrator-guide-step1").addClass("calibrator-guide-active");
        break;
      case this.STEP_BRIGHTNESS:
        $("#calibrator-guide-step2").addClass("calibrator-guide-active");
        break;
      case this.STEP_SUMMARY:
        $("#calibrator-guide-step3").addClass("calibrator-guide-active");
        break;
      }
    } else {
      console.log("Calibrator.js: calibrator-guide div not in the dom.");
    }
  }

  /* ======== Event Handling Methods ======== */

  /**
   * Resets event listeners after DOM change
   * @return {undefined} 
   * @private
   */
  resetEvents() {

    /** Remove current handlers */
    $(".calibrator-info-icon").off();
    $(".calibrator-dismiss-icon").off();
    $(".calibrator-button").off();
    $(".calibrator-size-range").off();

    /**
     * Hold the reference to the calibrator object for callbacks
     * @type {Object}
     */
    var thisObject = this;

    $(".calibrator-info-icon").on("click", function (e) {
      thisObject.toggleInfo();
    });

    $(".calibrator-dismiss-icon").on("click", function (e) {
      thisObject.callbackNow(0);
      thisObject.hide();
    });

    $(".calibrator-button").on("click", function (e) {
      thisObject.buttonClicked(e);
    });

    $(".calibrator-size-range").on("change", function (e) {
      thisObject.setRatioFromRange($(e.target));
      thisObject.drawImage();
      thisObject.updateSummaryInformation();
    });

  }

  /* ======== Step Management Methods ======== */

  /**
   * Go to the specified step. 
   * @param  {Number} step step index as defined by calibrate.STEP_XXX
   * @return {undefined}
   * @private
   */
  goToStep(step) {
    this.currentStep = step;
    this.updateView();
  }

  /**
   * After step content has been drawn, this function performs step specific logic.
   * @private
   */
  setStepLogic() {
    switch (this.currentStep) {
    case this.STEP_SCREENSIZE_ENTER_KNOWNSIZE:
      /**
       * If diagonalSize is valid - set the input to its value, else set _diagonalSize to null
       */
      if ($.isNumeric(this.diagonalSize)) {
        $("#calibrator-monitor-size")[0].value = this.diagonalSize.toFixed(this.FLOAT_PRECISION);
      } else {
        this.diagonalSize = null;
      }
      break;
    case this.STEP_SCREENSIZE_CHOOSE_OBJECT:
      // no logic
      break;
    case this.STEP_SCREENSIZE_ENTER_OBJECTSIZE:
      this.setRangeFromRatio();
      this.setDiagonalSizeFromRatio();
      this.drawImage();
      this.updateSummaryInformation();
      break;
    case this.STEP_BRIGHTNESS:
      this.drawGrayScale();
      console.log(this.pixelsPerDegree);
      break;
    case this.STEP_SUMMARY:
      break;

    }
  }

  /**
   * Goes to previous step.
   * @return {undefined}
   * @private
   */
  goToPreviousStep() {
    switch (this.currentStep) {
    case this.STEP_SCREENSIZE_ENTER_KNOWNSIZE:
      this.goToStep(this.STEP_SCREENSIZE_ASK_IFKNOWS);
      break;
    case this.STEP_SCREENSIZE_CHOOSE_OBJECT:
      this.goToStep(this.STEP_SCREENSIZE_ASK_IFKNOWS);
      break;
    case this.STEP_SCREENSIZE_ENTER_OBJECTSIZE:
      this.goToStep(this.STEP_SCREENSIZE_CHOOSE_OBJECT);
      break;
    case this.STEP_BRIGHTNESS:
      this.goToStep(this.STEP_SCREENSIZE_ASK_IFKNOWS);
      break;
    case this.STEP_SUMMARY:
      this.goToStep(this.STEP_BRIGHTNESS);
      break;

    }
  }

  /**
   * Add a back button to the content div.
   * @private
   */
  addBackButton() {
    /** look for a .calibrator-backdiv placeholder in the document */
    if ($(".calibrator-backdiv").length) {
      var backButtonHtml = '<button class="btn calibrator-button calibrator-button-back" value="back">' +
        'Back' +
        '</button>';
      $(".calibrator-backdiv").append(backButtonHtml);
    } else {
      var backButtonHtml = '<div class="col-xs-12 calibrator-spacing">' +
        '</div>' +
        '<div class="col-xs-12 ">' +
        '<button class="btn calibrator-button calibrator-button-back" value="back">' +
        'Back' +
        '</button>' +
        '</div>';
      $(".calibrator-content").append(backButtonHtml);
    }

  }

  /**
   * handles all events related to the calibrator buttons being clicked
   * @param  {object} event event from the callback
   * @private
   */
  buttonClicked(event) {
    var buttonValue = event.target.value;

    switch (buttonValue) {
    case this.BUTTON_SIZEKNOWN:
      this.goToStep(this.STEP_SCREENSIZE_ENTER_KNOWNSIZE);
      break;
    case this.BUTTON_SIZEUNKNOWN:
      this.goToStep(this.STEP_SCREENSIZE_CHOOSE_OBJECT);
      break;

    case this.BUTTON_CONFIRM_MANUALSIZE:
      if ($.isNumeric($("#calibrator-monitor-size")[0].value)) {
        this.diagonalSize = Number($("#calibrator-monitor-size")[0].value);
        this.goToStep(this.STEP_BRIGHTNESS);
      } else {
        console.log("Calibrator.js: monitor size is invalid");
      }
      break;

    case this.BUTTON_CHOOSE_CREDITCARD:
      this._currentImage = this.IMAGE_KEY_CREDITCARD;
      this.updateCanvasHeight();
      this.goToStep(this.STEP_SCREENSIZE_ENTER_OBJECTSIZE);
      break;
    case this.BUTTON_CHOOSE_COMPACTDISK:
      this._currentImage = this.IMAGE_KEY_CD;
      this.updateCanvasHeight();
      this.goToStep(this.STEP_SCREENSIZE_ENTER_OBJECTSIZE);
      break;
    case this.BUTTON_CONFIRM_OBJECTSIZE:
      this.goToStep(this.STEP_BRIGHTNESS);
      break;
    case this.BUTTON_CONFIRM_BRIGHTNESS:
      this.goToStep(this.STEP_SUMMARY);
      break;
    case this.BUTTON_FINAL_CONFIRM:
      this.callbackNow(1);
      this.hide();
      break;

    case this.BUTTON_BACK:
      this.goToPreviousStep();
      break;
    }
  }

  /* ======== Summarize Informations ======== */

  /**
   * Function that looks for place holders in the current page for summary information and updates it using calibrator.FLOAT_PRECISION.
   * @return {undefined}
   * @private
   */
  updateSummaryInformation() {
    var thisObject = this;
    if ($(".calibrator-diagonal-size-inches").length) {
      _.each($(".calibrator-diagonal-size-inches"), function (element) {
        $(element).html(thisObject.diagonalSize.toFixed(thisObject.FLOAT_PRECISION) + " inches");
      });
    }

  }

  /* ======== Callback Methods ======== */

  /**
   * Function called when calibrator is dismissed. Call the callbackWhenClosed function if it was provided, else just print the result of the calibrator in the console.
   * @param  {Number} status 0 for an early exit. 1 for a normal exit.
   */
  callbackNow(status) {
    var returnObject = {
      status: 0,
      diagonalSize: null,
      diagonalSizeInPx: this.diagonalSizeInPx,
      distanceFromScreenInCm: null,
      pixelsPerInch: null,
      pixelsPerDegree: null

    };

    if (this.diagonalSize) {
      returnObject.status = status;
      returnObject.diagonalSize = this.diagonalSize;
      returnObject.distanceFromScreenInCm = this.distanceFromScreen;
      returnObject.pixelsPerInch = this.pixelsPerInch;
      returnObject.pixelsPerDegree = this.pixelsPerDegree;

    }

    if (this.callbackWhenClosed) {
      this.callbackWhenClosed(returnObject);
    } else {
      console.log("Calibrator.js: Has been dismissed");
      console.log(returnObject);
    }

  }

  /* ======== Object Methods ======== */

  /**
   * Update canvas height as a function of the selected image.
   * @return {undefined}
   * @private
   */
  updateCanvasHeight() {
    if (this.currentImage) {
      var imageMaxHeight = this.IMAGES[this.currentImage][1][1] * this.IMAGES[this.currentImage][3];
      this.canvasHeight = imageMaxHeight + 50;
    }
  }

  /**
   * Resizes the canvas to avoid unwanted scaling. Defines the canvas height as this.canvasHeight
   * @return {undefined}
   * @private
   */
  fitCanvasToContainer() {
    if ($(".calibrator-canvas").length) {
      var canvas = $(".calibrator-canvas")[0];

      /* Make it visually fill the positioned parent */
      canvas.style.width = '100%';
      canvas.style.height = this.canvasHeight + 'px';

      /* then set the internal size to match */
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
  }

  /**
   * Function handling canvas resize and redraw 
   */
  canvasResized() {
    this.fitCanvasToContainer();
    switch (this.currentStep) {
    case this.STEP_SCREENSIZE_ENTER_OBJECTSIZE:
      this.setDiagonalSizeFromRatio();
      this.drawImage();
      break;
    case this.STEP_BRIGHTNESS:
      this.drawGrayScale();
      break;
    }
  }

  drawImage() {
    if (($(".calibrator-canvas").length) && (this.currentStep == this.STEP_SCREENSIZE_ENTER_OBJECTSIZE)) {
      this.fitCanvasToContainer();
      var canvas = $(".calibrator-canvas")[0];
      var canvasContext = canvas.getContext("2d");
      // var centerX = canvas.width / 2;
      // var centerY = canvas.height / 2;

      /** Clear for redraw */
      canvasContext.clearRect(0, 0, canvas.width, canvas.height);

      /**  Center the image */
      var drawAtX = (canvas.width - this.currentImageScaledWidthInPx) / 2;
      var drawAtY = (canvas.height - this.currentImageScaledHeightInPx) / 2;
      canvasContext.drawImage(this.cachedImages[this._currentImage],
        drawAtX, drawAtY, this.currentImageScaledWidthInPx, this.currentImageScaledHeightInPx);
    }
  }

  setRatioFromRange(element = null) {
    if (element === null) {
      element = $(".calibrator-size-range");
    }

    if ($(element).length) {
      var range = Number($(element).attr("max")) - Number($(element).attr("min"));
      var value = Number($(element).val());
      this.imageRatio = value / range;
    }
  }

  setRangeFromRatio(element = null) {
    if (element === null) {
      element = $(".calibrator-size-range");
    }

    if ($(element).length) {
      var range = Number($(element).attr("max")) - Number($(element).attr("min"));
      $(element).val((this.imageRatio * range) + Number($(element).attr("min")));
    }

  }

  /**
   * Set the diagonal size in inches from the pixel per inches calculate fron the scaled currentImage drawn on the canvas.
   * @private
   */
  setDiagonalSizeFromRatio() {
    if (this.currentImage) {
      this.diagonalSize = this.diagonalSizeInPx / (this.currentImageScaledWidthInPx / this.currentImagePhysicalWidthInInches);
    }
  }

  /* ======== Brightness ======== */

  drawGrayScale() {
    if (($(".calibrator-canvas").length) && (this.currentStep == this.STEP_BRIGHTNESS)) {
      this.fitCanvasToContainer();
      var canvas = $(".calibrator-canvas")[0];
      var canvasContext = canvas.getContext("2d");

      /** Clear for redraw */
      canvasContext.clearRect(0, 0, canvas.width, canvas.height);

      // canvasContext.fillStyle = "white";
      // canvasContext.fillRect(0, 0, canvas.width, canvas.height);
      // var boxWidth = Math.round(1 * this.pixelsPerCm); //cm
      // var boxHeight = Math.round(4 * this.pixelsPerCm); //cm

      var boxWidth = 30;
      var boxHeight = 150;
      var centerX = Math.round(canvas.width / 2);
      var centerY = Math.round(canvas.height / 2);
      var topX = centerX - (boxWidth * this.BRIGHTNESS_NUMBER_OF_CONTRASTS / 2);
      var topY = centerY - (boxHeight / 2);

      for (var i = 0; i < this.BRIGHTNESS_NUMBER_OF_CONTRASTS; i++) {
        var luminosity = Math.round(i * (255 / (this.BRIGHTNESS_NUMBER_OF_CONTRASTS - 1)));

        canvasContext.fillStyle = "rgb(" + luminosity + "," + luminosity + "," + luminosity + ")";
        canvasContext.fillRect((topX + i * boxWidth), topY, boxWidth, boxHeight);
      }

    } else {
      throw new Error("Calibrator.js: the canvas element is not present, cannot drawImage().");
    }

    // pxpercm = Math.round(window.pxperinch / 2.54);

    // //calculate pixels per degree
    // var angle = Math.atan(screen.height / screen.width);
    // var diagCM = (getSliderValue() / 10) * 2.54;
    // var screenWidthCM = diagCM * Math.cos(angle);

    // window.pxperdeg = Math.PI / 180 * screen.width * distance / screenWidthCM;
    // window.monitorSize = parseFloat($("#screenInput").val());

  }

  /* =============== Getters and Setters =============== */

  /* ======== Current Step Content ======== */

  /**
   * Returns the currentStep Title from calibrator.STEP_TITLES
   * @return {String} Title
   * @private
   */
  get currentTitle() {
    switch (this.currentStep) {
    case this.STEP_SCREENSIZE_ASK_IFKNOWS:
      return (this.STEP_TITLES[0]);
    case this.STEP_SCREENSIZE_ENTER_KNOWNSIZE:
      return (this.STEP_TITLES[0]);
    case this.STEP_SCREENSIZE_CHOOSE_OBJECT:
      return (this.STEP_TITLES[0]);
    case this.STEP_SCREENSIZE_ENTER_OBJECTSIZE:
      return (this.STEP_TITLES[0]);
    case this.STEP_BRIGHTNESS:
      return (this.STEP_TITLES[1]);
    case this.STEP_SUMMARY:
      return (this.STEP_TITLES[2]);

    }

  }

  /**
   * Returns the compiled currentStep content from the templateManager
   * @return {String} HTML Content
   * @private
   */
  get currentContent() {
    switch (this.currentStep) {
    case this.STEP_SCREENSIZE_ASK_IFKNOWS:
      return (this.templateManager.render("knownsize"));
    case this.STEP_SCREENSIZE_ENTER_KNOWNSIZE:
      return (this.templateManager.render("enterknownsize"));
    case this.STEP_SCREENSIZE_CHOOSE_OBJECT:
      return (this.templateManager.render("chooseobject"));
    case this.STEP_SCREENSIZE_ENTER_OBJECTSIZE:
      return (this.templateManager.render("specifystandardsize"));
    case this.STEP_BRIGHTNESS:
      return (this.templateManager.render("setbrightness"));
    case this.STEP_SUMMARY:
      return (this.templateManager.render("summary", {
        diagonalSize: this.diagonalSize.toFixed(this.FLOAT_PRECISION),
        diagonalSizeInPx: Math.ceil(this.diagonalSizeInPx),
        pixelsPerDegree: this.pixelsPerDegree.toFixed(this.FLOAT_PRECISION),
        pixelsPerInch: this.pixelsPerInch.toFixed(this.FLOAT_PRECISION)
      }));

    }
  }

  /* ======= Size processing ======= */

  /* === Screen size === */

  /**
   * Sets physical screen diagonal in inches. Key variable of the object.
   * @return {undefined} 
   * @private
   */
  set diagonalSize(value) {
    if (value === null) {
      this._diagonalSize = null;
      return;
    }

    value = Number(value);
    if ((value > 0) && (value < 60)) {
      this._diagonalSize = value;
    } else {
      console.log("Calibrator.js: Invalid diagonal size");
    }
  }

  /**
   * Screen physical diagonal size in inches
   * @return {Number} Number of inches on the screen's diagonal
   */
  get diagonalSize() {
    if (this._diagonalSize) {
      return (this._diagonalSize);
    } else {
      //console.log("Calibrator.js: diagonalSize is not set.");
      return (null);
    }
  }

  /**
   * Physical diagonal size of the screen in cm. 
   * @return {Number} Number of cm on the screen's diagonal
   */
  get diagonalSizeInCm() {
    if (this.diagonalSize) {
      return (this.diagonalSize * 2.54);
    } else {
      return (null);
    }
  }

  /**
   * Returns Diagonal of the screen in pixels. Depends on the resolution of the screen. We are always able to compute it.
   * @return {Number} Number of pixels on the screen diagonal
   */
  get diagonalSizeInPx() {
    return (Math.sqrt(Math.pow(screen.availWidth, 2) + Math.pow(screen.availHeight, 2)));
  }

  /**
   * Return the screen pixel per inches
   * @return {Number} Pixel per inches
   */
  get pixelsPerInch() {
    if (this.diagonalSize) {
      return (this.diagonalSizeInPx / this.diagonalSize);
    } else {
      return (null);
    }
  }

  /**
   * Return the screen pixel per cm
   * @return {Number} Pixel per cm
   */
  get pixelsPerCm() {
    if (this.diagonalSize) {
      return (this.pixelsPerInch / 2.54);
    } else {
      return (null);
    }
  }

  /**
   * Returns the pixels per degree as a function of pixel density of the screen and subject's distance from the screen
   * @return {Number} Pixel per degree
   */
  get pixelsPerDegree() {
    if (this.diagonalSize) {
      var visualAngleInRadian = 2 * Math.atan((screen.availWidth / this.pixelsPerCm) / (2 * this.distanceFromScreen));
      var degreePerRadian = (180 / Math.PI);
      return (screen.availWidth / (degreePerRadian * visualAngleInRadian));
    } else {
      return (null);
    }
  }

  /* === Image size === */

  /**
   * Sets the image scale ratio 
   * @param  {Number} ratio Real number between 0 and 1
   * @private     
   */
  set imageRatio(ratio) {
    if ((ratio >= 0) && (ratio <= 1)) {
      this._imageRatio = ratio;
      this.setDiagonalSizeFromRatio();
      this.drawImage();
    }
  }

  /**
   * Current image scale ratio
   * @return {Number} Ratio between 0 and 1 (this ratio will then be multiplied by the maximum scaling factor for each image to produce the observed size)
   */
  get imageRatio() {
    return (this._imageRatio);
  }

  /**
   * Set the current selected image to the specified key and redraw.
   * @param  {string} imageKey image key as stored in calibrator.IMAGES
   * @private
   */
  set currentImage(imageKey) {
    if (this.IMAGES.indexOf(imageKey) !== -1) {
      this._currentImage = imageKey;
      this.updateCanvasHeight();
      this.drawImage();
    }
  }

  /**
   * Get the current image key
   * @return {string} image key as stored in calibrator.IMAGES
   */
  get currentImage() {
    if (this._currentImage) {
      return (this._currentImage);
    } else {
      console.log("Calibrator.js: currentImage is not set.");
      return (null);
    }

  }

  /**
   * Get physical width of the object represented by the current image.
   * @return {Number} Size in cm 
   * @private
   */
  get currentImagePhysicalWidthInCm() {
    if (this.currentImage) {
      return (this.IMAGES[this.currentImage][2]);
    } else {
      return (null);
    }
  }

  /**
   * Get physical width of the object represented by the current image.
   * @return {Number} Size in inches 
   * @private
   */
  get currentImagePhysicalWidthInInches() {
    if (this.currentImage) {
      return (this.IMAGES[this.currentImage][2] / 2.54);
    } else {
      return (null);
    }
  }

  /**
   * Returns the scaled height depending on the selected scale factor (imageRatio) and maximum scaling of the image.
   * @return {Number} Scaled height in pixel
   * @private
   */
  get currentImageScaledHeightInPx() {
    if (this.currentImage) {
      /**
       * The scaled pixel size is the base pixel size * maximum scaling factor * ratio as determined by the slider/range position (imageRatio)
       */
      return (this.IMAGES[this.currentImage][1][1] * this.IMAGES[this.currentImage][3] * this.imageRatio);
    } else {
      return (null);
    }
  }

  /**
   * Returns the scaled width depending on the selected scale factor (imageRatio) and maximum scaling of the image.
   * @return {Number} Scaled width in pixel
   */
  get currentImageScaledWidthInPx() {
    if (this.currentImage) {
      /**
       * The scaled pixel size is the base pixel size * maximum scaling factor * ratio as determined by the slider/range position (imageRatio)
       */
      return (this.IMAGES[this.currentImage][1][0] * this.IMAGES[this.currentImage][3] * this.imageRatio);
    } else {
      return (null);
    }
  }

}

/* =============== TemplateManager Class =============== */

/**
 * Class to manage the loading of templates from external files using underscore.js simple templating capabilities and JQuery.
 */
class TemplateManager {

  /**
   * Constructor function for the templateManager
   * @param  {object} viewPaths          list of template URLs. Object keys will be used as the template name. 
   * {templateName1: templateUrl1, templateName2: templateUrl2, ...}
   * @param  {function} callbackWhenLoaded Callback function to call when templates are loaded.
   * @public
   */
  constructor(viewPaths = mandatory(), callbackWhenLoaded = null) {

    /* Allow double curly bracket syntax in the template html: {{variable}} */
    _.templateSettings.interpolate = /\{\{(.+?)\}\}/g;

    /**
     * Contains all templates urls
     * @type {object}
     */
    this.viewPaths = viewPaths;

    /**
     * Contains cached template in underscore template format
     * @type {Object}
     */
    this.cached = {};

    /** setup callback when all templates are loaded */
    if (callbackWhenLoaded) {
      this.callbackWhenLoaded = callbackWhenLoaded;
    } else {
      this.callbackWhenLoaded = function () {
        console.log("TemplateManager.js: all templates loaded.");
      };
    }

    /* Keeps reference to the current object */
    var thisObject = this;

    /* Caches every templates asynchronously */
    _.each(this.viewPaths, function (value, key, list) {
      $.get(thisObject.viewPaths[key], function (raw) {

        /** store after loading */
        thisObject.store(key, raw);

        /** checks if all template are loaded */
        if (_.every(_.keys(thisObject.viewPaths), function (key) {
            return (_.has(thisObject.cached, key));
          })) {
          /** All templates loaded, call the supplied callback. */
          thisObject.callbackWhenLoaded();
        }

      });
    });

  }

  /**
   * Render the HTML of a template based on its name.
   * @param  {string} name      template name
   * @param  {Object} variables Object holding the variable values to replace in the template before rendering.
   */
  render(name, variables = {}) {
    var thisObject = this;
    if (this.isCached(name)) {
      return (this.cached[name](variables));
    } else {
      $.get(this.urlFor(name), function (raw) {
        thisObject.store(name, raw);
        thisObject.render(name, variables);
      });
    }
  }

  /**
   * Render the HTML of a template based on its name into a DOM target.
   * @param  {string} name      template name
   * @param  {Object} variables Object holding the variable values to replace in the template before rendering.
   * @param  {Object} target    DOM element to render the HTML into
   */
  renderInTarget(name, variables, target) {
    var thisObject = this;
    if (this.isCached(name)) {
      $(target).append(this.cached[name](variables));
    } else {
      $.get(this.urlFor(name), function (raw) {
        thisObject.store(name, raw);
        thisObject.renderInTarget(name, variables, target);
      });
    }

  }

  /**
   * Synchronous fetching and rendering using ajax synchronous file fetching.
   * @param  {string}   name     template name
   */
  renderSync(name) {
    if (!this.isCached(name)) {
      this.fetch(name);
    }
    this.render(name);
  }

  /**
   * Preloads and cache the template as underscore templates.
   * @param  {string} name template name
   */
  prefetch(name) {
    var thisObject = this;
    $.get(this.urlFor(name), function (raw) {
      thisObject.store(name, raw);
    });
  }

  /**
   * Synchronously fetch a template.
   * @param  {string} name template name 
   */
  fetch(name) {
    // synchronous, for those times when you need it.
    if (!this.isCached(name)) {
      var raw = $.ajax({
        'url': this.urlFor(name),
        'async': false
      }).responseText;
      this.store(name, raw);
    }
  }

  /**
   * Checks if a specified template is already cached
   * @param  {string}  name template name
   * @return {Boolean}      
   */
  isCached(name) {
    return !!this.cached[name];
  }

  /**
   * Stores a template from raw html as a underscore template.
   * @param  {string} name template name
   * @param  {string} raw  template html 
   */
  store(name, raw) {
    this.cached[name] = _.template(raw);
  }

  /**
   * Return the path of the specified template
   * @param  {string} name template name
   * @return {string}      template url
   */
  urlFor(name) {
    return (this.viewPaths[name]);
  }
}

/* =============== Utility Functions =============== */

/**
 * Called when mandatory argument is not set
 * @param  {String} param Optional name of the missing argument
 */

function mandatory(param = "") {

  throw new Error('Missing parameter ' + param);
}

/**
 * Find all the positions of a needle in a haystack string
 * @param  {string} needle   string to find
 * @param  {string} haystack string to scan
 * @return {Array}  Either -1 if no match is found or an array containing the indicies
 */
function findAllIndices(needle = mandatory(), haystack = mandatory()) {
  var indices = [];
  for (var i = 0; i < haystack.length; i++) {
    if ((haystack.substr(i, needle.length)) === needle) {
      indices.push(i);
    }
  }

  if (indices.length) {
    return (indices);
  } else {
    return (-1);
  }
}
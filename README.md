# Calibrator.js

Screen calibrator boilerplate for web based experiments.

## Usage
Needs Jquery, Bootstrap and Underscore.js. 

For production use the compiled and minified file : calibrator-compiled.min.js

```
<script src="https://code.jquery.com/jquery-2.2.4.min.js">
</script>
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/js/bootstrap.min.js">
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min.js">
</script>
<script src="../js/calibrator-compiled.min.js" type="text/javascript">
</script>
<link href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css" rel="stylesheet"/>
<style>
    html, body {
        margin: 0;
    }

    body {
        background: #E3E3E3;
    }
</style>
<script type="text/javascript">
    var calibrator;
    document.addEventListener("DOMContentLoaded", function(event) {
        /**
         * After DOM is completely loaded, create a calibrator instance. Provided arguement to the constructor is the callbackWhenClosed. It is call whenever the calibrator is dismissed. 
         * calibratorOutput Argument sent to the callback is an object with keys 
         *   * status 
         *     + 0 the calibrator did not finish normally
         *     + 1 calibrator finish normally
         *   * diagonalSize 
         *     + diagonal size in inches
         *   * diagonalSizeInPx
         *     + diagonal size in inches
         *   * distanceFromScreenInCm
         *     + distance from the screen in cm (calibrator.DISTANCE_FROM_SCREEN)
         *   * pixelsPerInch
         *     + computed pixel density in pixels per inch
         *   * pixelsPerDegree
         *     + computed pixels per degree
         * @param  {[type]} object) {            console.log(object); } [description]
         * @return {[type]}         [description]
         */
        calibrator = new Calibrator(function(calibratorOutput) { console.log(calibratorOutput); });
    });
</script>
```

**A possible implementation is given in calibrator/example/index.html.**
 

## Documentation
https://albertbuchard.github.io/calibrator-js-docs/


## Authors
Albert Buchard
Amanda Yung
Augustin Joessel


## LICENCE
MIT - 2016
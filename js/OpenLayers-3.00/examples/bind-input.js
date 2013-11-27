goog.require('ol.Map');
goog.require('ol.RendererHints');
goog.require('ol.View2D');
goog.require('ol.dom.Input');
goog.require('ol.layer.Tile');
goog.require('ol.source.OSM');
goog.require('ol.webgl');


if (!ol.webgl.SUPPORTED) {
  var inputs = document.getElementsByClassName('webgl');
  for (var i = 0, len = inputs.length; i < len; i++) {
    inputs[i].disabled = true;
  }
  var info = document.getElementById('no-webgl');
  /**
   * display warning message
   */
  info.style.display = '';
}

var layer = new ol.layer.Tile({
  source: new ol.source.OSM()
});
var map = new ol.Map({
  layers: [layer],
  renderers: ol.RendererHints.createFromQueryData(),
  target: 'map',
  view: new ol.View2D({
    center: [0, 0],
    zoom: 2
  })
});

var visible = new ol.dom.Input(document.getElementById('visible'));
visible.bindTo('checked', layer, 'visible');

var opacity = new ol.dom.Input(document.getElementById('opacity'));
opacity.bindTo('value', layer, 'opacity')
    .transform(parseFloat, String);

var hue = new ol.dom.Input(document.getElementById('hue'));
hue.bindTo('value', layer, 'hue')
    .transform(parseFloat, String);

var saturation = new ol.dom.Input(document.getElementById('saturation'));
saturation.bindTo('value', layer, 'saturation')
    .transform(parseFloat, String);

var contrast = new ol.dom.Input(document.getElementById('contrast'));
contrast.bindTo('value', layer, 'contrast')
    .transform(parseFloat, String);

var brightness = new ol.dom.Input(document.getElementById('brightness'));
brightness.bindTo('value', layer, 'brightness')
    .transform(parseFloat, String);


var rotation = new ol.dom.Input(document.getElementById('rotation'));
rotation.bindTo('value', map.getView(), 'rotation')
    .transform(parseFloat, String);

var resolution = new ol.dom.Input(document.getElementById('resolution'));
resolution.bindTo('value', map.getView(), 'resolution')
    .transform(parseFloat, String);

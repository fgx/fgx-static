goog.require('ol.DeviceOrientation');
goog.require('ol.Map');
goog.require('ol.RendererHints');
goog.require('ol.View2D');
goog.require('ol.dom.Input');
goog.require('ol.layer.Tile');
goog.require('ol.source.OSM');

var map = new ol.Map({
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
  ],
  renderers: ol.RendererHints.createFromQueryData(),
  target: 'map',
  view: new ol.View2D({
    center: [0, 0],
    zoom: 2
  })
});
var view = map.getView();

var deviceOrientation = new ol.DeviceOrientation();
var track = new ol.dom.Input(document.getElementById('track'));
track.bindTo('checked', deviceOrientation, 'tracking');

deviceOrientation.on('change', function(event) {
  document.getElementById('alpha').innerHTML = event.target.getAlpha();
  document.getElementById('beta').innerHTML = event.target.getBeta();
  document.getElementById('gamma').innerHTML = event.target.getGamma();
  document.getElementById('heading').innerHTML = event.target.getHeading();
});

// tilt the map
deviceOrientation.on(['change:beta', 'change:gamma'], function(event) {
  var center = view.getCenter();
  var resolution = view.getResolution();
  var beta = event.target.getBeta() || 0;
  var gamma = event.target.getGamma() || 0;

  center[0] -= resolution * gamma * 25;
  center[1] += resolution * beta * 25;

  view.setCenter(center);
});

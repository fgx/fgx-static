goog.provide('ol.interaction.Draw');

goog.require('goog.asserts');

goog.require('ol.Coordinate');
goog.require('ol.Feature');
goog.require('ol.Map');
goog.require('ol.MapBrowserEvent');
goog.require('ol.MapBrowserEvent.EventType');
goog.require('ol.geom.GeometryType');
goog.require('ol.geom.LineString');
goog.require('ol.geom.MultiLineString');
goog.require('ol.geom.MultiPoint');
goog.require('ol.geom.MultiPolygon');
goog.require('ol.geom.Point');
goog.require('ol.geom.Polygon');
goog.require('ol.interaction.Interaction');
goog.require('ol.layer.Vector');
goog.require('ol.layer.VectorLayerRenderIntent');
goog.require('ol.source.Vector');



/**
 * Interaction that allows drawing geometries.
 * @param {ol.interaction.DrawOptions} options Options.
 * @constructor
 * @extends {ol.interaction.Interaction}
 */
ol.interaction.Draw = function(options) {
  goog.base(this);

  /**
   * Target layer for drawn features.
   * @type {ol.layer.Vector}
   * @private
   */
  this.layer_ = options.layer;

  /**
   * Temporary sketch layer.
   * @type {ol.layer.Vector}
   * @private
   */
  this.sketchLayer_ = null;

  /**
   * Pixel distance for snapping.
   * @type {number}
   * @private
   */
  this.snapTolerance_ = goog.isDef(options.snapTolerance) ?
      options.snapTolerance : 12;

  /**
   * Geometry type.
   * @type {ol.geom.GeometryType}
   * @private
   */
  this.type_ = options.type;

  /**
   * Drawing mode (derived from geometry type.
   * @type {ol.interaction.DrawMode}
   * @private
   */
  this.mode_ = ol.interaction.Draw.getMode_(this.type_);

  /**
   * Finish coordinate for the feature (first point for polygons, last point for
   * linestrings).
   * @type {ol.Coordinate}
   * @private
   */
  this.finishCoordinate_ = null;

  /**
   * Sketch feature.
   * @type {ol.Feature}
   * @private
   */
  this.sketchFeature_ = null;

  /**
   * Sketch point.
   * @type {ol.Feature}
   * @private
   */
  this.sketchPoint_ = null;

  /**
   * Squared tolerance for handling click events.  If the squared distance
   * between a down and click event is greater than this tolerance, click events
   * will not be handled.
   * @type {number}
   * @private
   */
  this.squaredClickTolerance_ = 4;

};
goog.inherits(ol.interaction.Draw, ol.interaction.Interaction);


/**
 * @inheritDoc
 */
ol.interaction.Draw.prototype.setMap = function(map) {
  var oldMap = this.getMap();
  if (!goog.isNull(oldMap)) {
    oldMap.removeLayer(this.sketchLayer_);
  }

  if (!goog.isNull(map)) {
    if (goog.isNull(this.sketchLayer_)) {
      var layer = new ol.layer.Vector({
        source: new ol.source.Vector({parser: null}),
        style: this.layer_.getStyle()
      });
      layer.setTemporary(true);
      this.sketchLayer_ = layer;
    }
    map.addLayer(this.sketchLayer_);
  } else {
    // removing from a map, clean up
    this.abortDrawing_();
    this.sketchLayer_ = null;
  }

  goog.base(this, 'setMap', map);
};


/**
 * @inheritDoc
 */
ol.interaction.Draw.prototype.handleMapBrowserEvent = function(event) {
  var map = event.map;
  if (!map.isDef()) {
    return true;
  }
  var pass = true;
  if (event.type === ol.MapBrowserEvent.EventType.CLICK) {
    pass = this.handleClick_(event);
  } else if (event.type === ol.MapBrowserEvent.EventType.MOUSEMOVE) {
    pass = this.handleMove_(event);
  } else if (event.type === ol.MapBrowserEvent.EventType.DBLCLICK) {
    pass = false;
  }
  return pass;
};


/**
 * Handle click events.
 * @param {ol.MapBrowserEvent} event A click event.
 * @return {boolean} Pass the event to other interactions.
 * @private
 */
ol.interaction.Draw.prototype.handleClick_ = function(event) {
  var downPx = event.map.getEventPixel(event.target.getDown());
  var clickPx = event.getPixel();
  var dx = downPx[0] - clickPx[0];
  var dy = downPx[1] - clickPx[1];
  var squaredDistance = dx * dx + dy * dy;
  var pass = true;
  if (squaredDistance <= this.squaredClickTolerance_) {
    if (goog.isNull(this.finishCoordinate_)) {
      this.startDrawing_(event);
    } else if (this.mode_ === ol.interaction.DrawMode.POINT ||
        this.atFinish_(event)) {
      this.finishDrawing_(event);
    } else {
      this.addToDrawing_(event);
    }
    pass = false;
  }
  return pass;
};


/**
 * Handle mousemove events.
 * @param {ol.MapBrowserEvent} event A mousemove event.
 * @return {boolean} Pass the event to other interactions.
 * @private
 */
ol.interaction.Draw.prototype.handleMove_ = function(event) {
  if (this.mode_ === ol.interaction.DrawMode.POINT &&
      goog.isNull(this.finishCoordinate_)) {
    this.startDrawing_(event);
  } else if (!goog.isNull(this.finishCoordinate_)) {
    this.modifyDrawing_(event);
  }
  return true;
};


/**
 * Determine if an event is within the snapping tolerance of the start coord.
 * @param {ol.MapBrowserEvent} event Event.
 * @return {boolean} The event is within the snapping tolerance of the start.
 * @private
 */
ol.interaction.Draw.prototype.atFinish_ = function(event) {
  var at = false;
  if (this.sketchFeature_) {
    var geometry = this.sketchFeature_.getGeometry();
    var potentiallyDone = false;
    if (this.mode_ === ol.interaction.DrawMode.LINESTRING) {
      potentiallyDone = geometry.getCoordinates().length > 2;
    } else if (this.mode_ === ol.interaction.DrawMode.POLYGON) {
      potentiallyDone = geometry.getRings()[0].getCoordinates().length > 3;
    }
    if (potentiallyDone) {
      var map = event.map;
      var finishPixel = map.getPixelFromCoordinate(this.finishCoordinate_);
      var pixel = event.getPixel();
      var dx = pixel[0] - finishPixel[0];
      var dy = pixel[1] - finishPixel[1];
      at = Math.sqrt(dx * dx + dy * dy) <= this.snapTolerance_;
    }
  }
  return at;
};


/**
 * Start the drawing.
 * @param {ol.MapBrowserEvent} event Event.
 * @private
 */
ol.interaction.Draw.prototype.startDrawing_ = function(event) {
  var start = event.getCoordinate();
  this.finishCoordinate_ = start;
  var sketchFeature = new ol.Feature();
  sketchFeature.setRenderIntent(ol.layer.VectorLayerRenderIntent.SELECTED);
  var features = [sketchFeature];
  var geometry;
  if (this.mode_ === ol.interaction.DrawMode.POINT) {
    geometry = new ol.geom.Point(start.slice());
  } else {
    var sketchPoint = new ol.Feature({
      geom: new ol.geom.Point(start.slice())
    });
    sketchPoint.setRenderIntent(ol.layer.VectorLayerRenderIntent.TEMPORARY);
    this.sketchPoint_ = sketchPoint;
    features.push(sketchPoint);

    if (this.mode_ === ol.interaction.DrawMode.LINESTRING) {
      geometry = new ol.geom.LineString([start.slice(), start.slice()]);
    } else if (this.mode_ === ol.interaction.DrawMode.POLYGON) {
      geometry = new ol.geom.Polygon([[start.slice(), start.slice()]]);
    }
  }
  goog.asserts.assert(goog.isDef(geometry));
  sketchFeature.setGeometry(geometry);
  this.sketchFeature_ = sketchFeature;

  this.sketchLayer_.addFeatures(features);
};


/**
 * Modify the drawing.
 * @param {ol.MapBrowserEvent} event Event.
 * @private
 */
ol.interaction.Draw.prototype.modifyDrawing_ = function(event) {
  var coordinate = event.getCoordinate();
  var geometry = this.sketchFeature_.getGeometry();
  var coordinates, last;
  if (this.mode_ === ol.interaction.DrawMode.POINT) {
    last = geometry.getCoordinates();
    last[0] = coordinate[0];
    last[1] = coordinate[1];
    geometry.setCoordinates(last);
  } else {
    if (this.mode_ === ol.interaction.DrawMode.LINESTRING) {
      coordinates = geometry.getCoordinates();
    } else if (this.mode_ === ol.interaction.DrawMode.POLYGON) {
      geometry = geometry.getRings()[0];
      coordinates = geometry.getCoordinates();
    }
    if (this.atFinish_(event)) {
      // snap to finish
      coordinate = this.finishCoordinate_.slice();
    }
    this.sketchPoint_.getGeometry().setCoordinates(coordinate);
    last = coordinates[coordinates.length - 1];
    last[0] = coordinate[0];
    last[1] = coordinate[1];
    geometry.setCoordinates(coordinates);
  }
};


/**
 * Add a new coordinate to the drawing.
 * @param {ol.MapBrowserEvent} event Event.
 * @private
 */
ol.interaction.Draw.prototype.addToDrawing_ = function(event) {
  var coordinate = event.getCoordinate();
  var geometry = this.sketchFeature_.getGeometry();
  var coordinates, last;
  if (this.mode_ === ol.interaction.DrawMode.LINESTRING) {
    this.finishCoordinate_ = coordinate.slice();
    coordinates = geometry.getCoordinates();
    coordinates.push(coordinate.slice());
    geometry.setCoordinates(coordinates);
  } else if (this.mode_ === ol.interaction.DrawMode.POLYGON) {
    var ring = geometry.getRings()[0];
    coordinates = ring.getCoordinates();
    coordinates.push(coordinate.slice());
    ring.setCoordinates(coordinates);
  }
};


/**
 * Stop drawing and add the sketch feature to the target layer.
 * @param {ol.MapBrowserEvent} event Event.
 * @private
 */
ol.interaction.Draw.prototype.finishDrawing_ = function(event) {
  var sketchFeature = this.abortDrawing_();
  goog.asserts.assert(!goog.isNull(sketchFeature));
  sketchFeature.setRenderIntent(ol.layer.VectorLayerRenderIntent.DEFAULT);
  var geometry = sketchFeature.getGeometry();
  var coordinates = geometry.getCoordinates();
  if (this.mode_ === ol.interaction.DrawMode.LINESTRING) {
    // remove the redundant last point
    coordinates.pop();
    geometry.setCoordinates(coordinates);
  } else if (this.mode_ === ol.interaction.DrawMode.POLYGON) {
    // force clockwise order for exterior ring
    sketchFeature.setGeometry(new ol.geom.Polygon(coordinates));
  }
  // cast multi-part geometries
  if (this.type_ === ol.geom.GeometryType.MULTIPOINT) {
    sketchFeature.setGeometry(new ol.geom.MultiPoint([coordinates]));
  } else if (this.type_ === ol.geom.GeometryType.MULTILINESTRING) {
    sketchFeature.setGeometry(new ol.geom.MultiLineString([coordinates]));
  } else if (this.type_ === ol.geom.GeometryType.MULTIPOLYGON) {
    sketchFeature.setGeometry(new ol.geom.MultiPolygon([coordinates]));
  }
  this.layer_.addFeatures([sketchFeature]);
};


/**
 * Stop drawing without adding the sketch feature to the target layer.
 * @return {ol.Feature} The sketch feature (or null if none).
 * @private
 */
ol.interaction.Draw.prototype.abortDrawing_ = function() {
  this.finishCoordinate_ = null;
  var sketchFeature = this.sketchFeature_;
  if (!goog.isNull(sketchFeature)) {
    var features = [sketchFeature];
    this.sketchFeature_ = null;
    if (this.mode_ !== ol.interaction.DrawMode.POINT) {
      features.push(this.sketchPoint_);
      this.sketchPoint_ = null;
    }
    this.sketchLayer_.removeFeatures(features);
  }
  return sketchFeature;
};


/**
 * Get the drawing mode.  The mode for mult-part geometries is the same as for
 * their single-part cousins.
 * @param {ol.geom.GeometryType} type Geometry type.
 * @return {ol.interaction.DrawMode} Drawing mode.
 * @private
 */
ol.interaction.Draw.getMode_ = function(type) {
  var mode;
  if (type === ol.geom.GeometryType.POINT ||
      type === ol.geom.GeometryType.MULTIPOINT) {
    mode = ol.interaction.DrawMode.POINT;
  } else if (type === ol.geom.GeometryType.LINESTRING ||
      type === ol.geom.GeometryType.MULTILINESTRING) {
    mode = ol.interaction.DrawMode.LINESTRING;
  } else if (type === ol.geom.GeometryType.POLYGON ||
      type === ol.geom.GeometryType.MULTIPOLYGON) {
    mode = ol.interaction.DrawMode.POLYGON;
  }
  goog.asserts.assert(goog.isDef(mode));
  return mode;
};


/**
 * Draw mode.  This collapses multi-part geometry types with their single-part
 * cousins.
 * @enum {string}
 */
ol.interaction.DrawMode = {
  POINT: 'point',
  LINESTRING: 'linestring',
  POLYGON: 'polygon'
};

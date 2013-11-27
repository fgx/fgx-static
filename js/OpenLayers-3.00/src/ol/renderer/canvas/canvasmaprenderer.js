// FIXME offset panning

goog.provide('ol.renderer.canvas.Map');

goog.require('goog.asserts');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.style');
goog.require('goog.vec.Mat4');
goog.require('ol.css');
goog.require('ol.layer.Image');
goog.require('ol.layer.Tile');
goog.require('ol.layer.Vector');
goog.require('ol.renderer.Map');
goog.require('ol.renderer.canvas.ImageLayer');
goog.require('ol.renderer.canvas.TileLayer');
goog.require('ol.renderer.canvas.VectorLayer');
goog.require('ol.source.State');



/**
 * @constructor
 * @extends {ol.renderer.Map}
 * @param {Element} container Container.
 * @param {ol.Map} map Map.
 */
ol.renderer.canvas.Map = function(container, map) {

  goog.base(this, container, map);

  /**
   * @private
   * @type {HTMLCanvasElement}
   */
  this.canvas_ = /** @type {HTMLCanvasElement} */
      (goog.dom.createElement(goog.dom.TagName.CANVAS));
  this.canvas_.style.width = '100%';
  this.canvas_.style.height = '100%';
  this.canvas_.className = ol.css.CLASS_UNSELECTABLE;
  goog.dom.insertChildAt(container, this.canvas_, 0);

  /**
   * @private
   * @type {boolean}
   */
  this.renderedVisible_ = true;

  /**
   * @private
   * @type {CanvasRenderingContext2D}
   */
  this.context_ = /** @type {CanvasRenderingContext2D} */
      (this.canvas_.getContext('2d'));

};
goog.inherits(ol.renderer.canvas.Map, ol.renderer.Map);


/**
 * @inheritDoc
 */
ol.renderer.canvas.Map.prototype.createLayerRenderer = function(layer) {
  if (layer instanceof ol.layer.Image) {
    return new ol.renderer.canvas.ImageLayer(this, layer);
  } else if (layer instanceof ol.layer.Tile) {
    return new ol.renderer.canvas.TileLayer(this, layer);
  } else if (layer instanceof ol.layer.Vector) {
    return new ol.renderer.canvas.VectorLayer(this, layer);
  } else {
    goog.asserts.fail();
    return null;
  }
};


/**
 * @inheritDoc
 */
ol.renderer.canvas.Map.prototype.getCanvas = function() {
  return this.canvas_;
};


/**
 * @inheritDoc
 */
ol.renderer.canvas.Map.prototype.renderFrame = function(frameState) {

  if (goog.isNull(frameState)) {
    if (this.renderedVisible_) {
      goog.style.setElementShown(this.canvas_, false);
      this.renderedVisible_ = false;
    }
    return;
  }

  var context = this.context_;

  var size = frameState.size;
  if (this.canvas_.width != size[0] || this.canvas_.height != size[1]) {
    this.canvas_.width = size[0];
    this.canvas_.height = size[1];
  } else {
    context.clearRect(0, 0, this.canvas_.width, this.canvas_.height);
  }

  this.calculateMatrices2D(frameState);

  var layerStates = frameState.layerStates;
  var layersArray = frameState.layersArray;
  var viewResolution = frameState.view2DState.resolution;
  var i, ii, image, layer, layerRenderer, layerState, transform;
  for (i = 0, ii = layersArray.length; i < ii; ++i) {

    layer = layersArray[i];
    layerRenderer =
        /** @type {ol.renderer.canvas.Layer} */ (this.getLayerRenderer(layer));
    layerState = layerStates[goog.getUid(layer)];
    if (!layerState.visible ||
        layerState.sourceState != ol.source.State.READY ||
        viewResolution >= layerState.maxResolution ||
        viewResolution < layerState.minResolution) {
      continue;
    }
    layerRenderer.renderFrame(frameState, layerState);

    image = layerRenderer.getImage();
    if (!goog.isNull(image)) {
      transform = layerRenderer.getTransform();
      context.globalAlpha = layerState.opacity;

      // for performance reasons, context.setTransform is only used
      // when the view is rotated. see http://jsperf.com/canvas-transform
      if (frameState.view2DState.rotation === 0) {
        var dx = goog.vec.Mat4.getElement(transform, 0, 3);
        var dy = goog.vec.Mat4.getElement(transform, 1, 3);
        var dw = image.width * goog.vec.Mat4.getElement(transform, 0, 0);
        var dh = image.height * goog.vec.Mat4.getElement(transform, 1, 1);
        goog.asserts.assert(goog.isNumber(image.width));
        goog.asserts.assert(goog.isNumber(image.height));
        context.drawImage(image, 0, 0, image.width, image.height,
            Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
      } else {
        context.setTransform(
            goog.vec.Mat4.getElement(transform, 0, 0),
            goog.vec.Mat4.getElement(transform, 1, 0),
            goog.vec.Mat4.getElement(transform, 0, 1),
            goog.vec.Mat4.getElement(transform, 1, 1),
            goog.vec.Mat4.getElement(transform, 0, 3),
            goog.vec.Mat4.getElement(transform, 1, 3));

        context.drawImage(image, 0, 0);
        context.setTransform(1, 0, 0, 1, 0, 0);
      }
    }

  }

  if (!this.renderedVisible_) {
    goog.style.setElementShown(this.canvas_, true);
    this.renderedVisible_ = true;
  }

  this.scheduleRemoveUnusedLayerRenderers(frameState);

};

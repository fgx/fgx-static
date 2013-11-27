goog.provide('ol.webgl');
goog.provide('ol.webgl.WebGLContextEventType');

goog.require('goog.dom');
goog.require('goog.dom.TagName');


/**
 * @const
 * @private
 * @type {Array.<string>}
 */
ol.webgl.CONTEXT_IDS_ = [
  'experimental-webgl',
  'webgl',
  'webkit-3d',
  'moz-webgl'
];


/**
 * @enum {string}
 */
ol.webgl.WebGLContextEventType = {
  LOST: 'webglcontextlost',
  RESTORED: 'webglcontextrestored'
};


/**
 * @param {HTMLCanvasElement} canvas Canvas.
 * @param {Object=} opt_attributes Attributes.
 * @return {WebGLRenderingContext} WebGL rendering context.
 */
ol.webgl.getContext = function(canvas, opt_attributes) {
  var context, i, ii = ol.webgl.CONTEXT_IDS_.length;
  for (i = 0; i < ii; ++i) {
    try {
      context = canvas.getContext(ol.webgl.CONTEXT_IDS_[i], opt_attributes);
      if (!goog.isNull(context)) {
        return /** @type {!WebGLRenderingContext} */ (context);
      }
    } catch (e) {
    }
  }
  return null;
};


/**
 * Is supported.
 * @const
 * @type {boolean}
 */
ol.webgl.SUPPORTED = (function() {
  if (!('WebGLRenderingContext' in goog.global)) {
    return false;
  }
  try {
    var canvas = /** @type {HTMLCanvasElement} */
        (goog.dom.createElement(goog.dom.TagName.CANVAS));
    return !goog.isNull(ol.webgl.getContext(canvas));
  } catch (e) {
    return false;
  }
})();

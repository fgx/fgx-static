// FIXME recheck layer/map projection compatability when projection changes
// FIXME layer renderers should skip when they can't reproject
// FIXME add tilt and height?

goog.provide('ol.Map');
goog.provide('ol.MapProperty');
goog.provide('ol.RendererHint');
goog.provide('ol.RendererHints');

goog.require('goog.Uri.QueryData');
goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.async.AnimationDelay');
goog.require('goog.async.nextTick');
goog.require('goog.debug.Console');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.dom.ViewportSizeMonitor');
goog.require('goog.events');
goog.require('goog.events.BrowserEvent');
goog.require('goog.events.Event');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyHandler');
goog.require('goog.events.KeyHandler.EventType');
goog.require('goog.events.MouseWheelHandler');
goog.require('goog.events.MouseWheelHandler.EventType');
goog.require('goog.log');
goog.require('goog.log.Level');
goog.require('goog.object');
goog.require('goog.style');
goog.require('goog.vec.Mat4');
goog.require('ol.BrowserFeature');
goog.require('ol.Collection');
goog.require('ol.FrameState');
goog.require('ol.IView');
goog.require('ol.MapBrowserEvent');
goog.require('ol.MapBrowserEvent.EventType');
goog.require('ol.MapBrowserEventHandler');
goog.require('ol.MapEvent');
goog.require('ol.MapEventType');
goog.require('ol.Object');
goog.require('ol.ObjectEventType');
goog.require('ol.Pixel');
goog.require('ol.PostRenderFunction');
goog.require('ol.PreRenderFunction');
goog.require('ol.Size');
goog.require('ol.Tile');
goog.require('ol.TileQueue');
goog.require('ol.View');
goog.require('ol.View2D');
goog.require('ol.ViewHint');
goog.require('ol.control');
goog.require('ol.extent');
goog.require('ol.interaction');
goog.require('ol.layer.Base');
goog.require('ol.layer.Group');
goog.require('ol.proj');
goog.require('ol.proj.common');
goog.require('ol.renderer.Map');
goog.require('ol.renderer.canvas');
goog.require('ol.renderer.canvas.Map');
goog.require('ol.renderer.dom');
goog.require('ol.renderer.dom.Map');
goog.require('ol.renderer.webgl');
goog.require('ol.renderer.webgl.Map');
goog.require('ol.structs.PriorityQueue');
goog.require('ol.vec.Mat4');


/**
 * @define {boolean} Whether to enable canvas.
 */
ol.ENABLE_CANVAS = true;


/**
 * @define {boolean} Whether to enable DOM.
 */
ol.ENABLE_DOM = true;


/**
 * @define {boolean} Whether to enable WebGL.
 */
ol.ENABLE_WEBGL = true;


/**
 * @enum {string}
 * @todo stability experimental
 */
ol.RendererHint = {
  CANVAS: 'canvas',
  DOM: 'dom',
  WEBGL: 'webgl'
};


/**
 * @type {Array.<ol.RendererHint>}
 */
ol.DEFAULT_RENDERER_HINTS = [
  ol.RendererHint.WEBGL,
  ol.RendererHint.CANVAS,
  ol.RendererHint.DOM
];


/**
 * @enum {string}
 */
ol.MapProperty = {
  LAYERGROUP: 'layergroup',
  SIZE: 'size',
  TARGET: 'target',
  VIEW: 'view'
};



/**
 * @class
 * The map is the core component of OpenLayers. In its minimal configuration it
 * needs a view, one or more layers, and a target container:
 *
 *     var map = new ol.Map({
 *       view: new ol.View2D({
 *         center: [0, 0],
 *         zoom: 1
 *       }),
 *       layers: [
 *         new ol.layer.Tile({
 *           source: new ol.source.MapQuestOSM()
 *         })
 *       ],
 *       target: 'map'
 *     });
 *
 * The above snippet creates a map with a MapQuest OSM layer on a 2D view and
 * renders it to a DOM element with the id `map`.
 *
 * @constructor
 * @extends {ol.Object}
 * @param {ol.MapOptions} options Map options.
 * @todo stability experimental
 * @todo observable layergroup {ol.layer.LayerGroup} a layer group containing
 *       the layers in this map.
 * @todo observable size {ol.Size} the size in pixels of the map in the DOM
 * @todo observable target {string|Element} the Element or id of the Element
 *       that the map is rendered in.
 * @todo observable view {ol.IView} the view that controls this map
 */
ol.Map = function(options) {

  goog.base(this);

  var optionsInternal = ol.Map.createOptionsInternal(options);

  /**
   * @private
   * @type {goog.async.AnimationDelay}
   */
  this.animationDelay_ =
      new goog.async.AnimationDelay(this.renderFrame_, undefined, this);
  this.registerDisposable(this.animationDelay_);

  /**
   * @private
   * @type {goog.vec.Mat4.Number}
   */
  this.coordinateToPixelMatrix_ = goog.vec.Mat4.createNumber();

  /**
   * @private
   * @type {goog.vec.Mat4.Number}
   */
  this.pixelToCoordinateMatrix_ = goog.vec.Mat4.createNumber();

  /**
   * @private
   * @type {number}
   */
  this.frameIndex_ = 0;

  /**
   * @private
   * @type {?ol.FrameState}
   */
  this.frameState_ = null;

  /**
   * @private
   * @type {number}
   */
  this.freezeRenderingCount_ = 0;

  /**
   * @private
   * @type {boolean}
   */
  this.dirty_ = false;

  /**
   * @private
   * @type {goog.events.Key}
   */
  this.viewPropertyListenerKey_ = null;

  /**
   * @private
   * @type {goog.events.Key}
   */
  this.layerGroupPropertyListenerKey_ = null;

  /**
   * @private
   * @type {Element}
   */
  this.viewport_ = goog.dom.createDom(goog.dom.TagName.DIV, 'ol-viewport');
  this.viewport_.style.position = 'relative';
  this.viewport_.style.overflow = 'hidden';
  this.viewport_.style.width = '100%';
  this.viewport_.style.height = '100%';
  // prevent page zoom on IE >= 10 browsers
  this.viewport_.style.msTouchAction = 'none';
  if (ol.BrowserFeature.HAS_TOUCH) {
    this.viewport_.className = 'ol-touch';
  }

  /**
   * @private
   * @type {Element}
   */
  this.overlayContainer_ = goog.dom.createDom(goog.dom.TagName.DIV,
      'ol-overlaycontainer');
  goog.dom.appendChild(this.viewport_, this.overlayContainer_);

  /**
   * @private
   * @type {Element}
   */
  this.overlayContainerStopEvent_ = goog.dom.createDom(goog.dom.TagName.DIV,
      'ol-overlaycontainer-stopevent');
  goog.events.listen(this.overlayContainerStopEvent_, [
    goog.events.EventType.CLICK,
    goog.events.EventType.DBLCLICK,
    goog.events.EventType.MOUSEDOWN,
    goog.events.EventType.TOUCHSTART,
    goog.events.EventType.MSPOINTERDOWN
  ], goog.events.Event.stopPropagation);
  goog.dom.appendChild(this.viewport_, this.overlayContainerStopEvent_);

  var mapBrowserEventHandler = new ol.MapBrowserEventHandler(this);
  goog.events.listen(mapBrowserEventHandler,
      goog.object.getValues(ol.MapBrowserEvent.EventType),
      this.handleMapBrowserEvent, false, this);
  this.registerDisposable(mapBrowserEventHandler);

  /**
   * @private
   * @type {goog.events.KeyHandler}
   */
  this.keyHandler_ = new goog.events.KeyHandler();
  goog.events.listen(this.keyHandler_, goog.events.KeyHandler.EventType.KEY,
      this.handleBrowserEvent, false, this);
  this.registerDisposable(this.keyHandler_);

  var mouseWheelHandler = new goog.events.MouseWheelHandler(this.viewport_);
  goog.events.listen(mouseWheelHandler,
      goog.events.MouseWheelHandler.EventType.MOUSEWHEEL,
      this.handleBrowserEvent, false, this);
  this.registerDisposable(mouseWheelHandler);

  /**
   * @type {ol.Collection}
   * @private
   */
  this.controls_ = optionsInternal.controls;

  /**
   * @type {ol.Collection}
   * @private
   */
  this.interactions_ = optionsInternal.interactions;

  /**
   * @type {ol.Collection}
   * @private
   */
  this.overlays_ = optionsInternal.overlays;

  /**
   * @type {ol.renderer.Map}
   * @private
   */
  this.renderer_ =
      new optionsInternal.rendererConstructor(this.viewport_, this);
  this.registerDisposable(this.renderer_);

  /**
   * @private
   */
  this.viewportSizeMonitor_ = new goog.dom.ViewportSizeMonitor();

  goog.events.listen(this.viewportSizeMonitor_, goog.events.EventType.RESIZE,
      this.updateSize, false, this);

  /**
   * @private
   * @type {ol.Coordinate}
   */
  this.focus_ = null;

  /**
   * @private
   * @type {Array.<ol.PreRenderFunction>}
   */
  this.preRenderFunctions_ = [];

  /**
   * @private
   * @type {Array.<ol.PostRenderFunction>}
   */
  this.postRenderFunctions_ = [];

  /**
   * @private
   * @type {ol.TileQueue}
   */
  this.tileQueue_ = new ol.TileQueue(
      goog.bind(this.getTilePriority, this),
      goog.bind(this.handleTileChange_, this));

  goog.events.listen(
      this, ol.Object.getChangeEventType(ol.MapProperty.LAYERGROUP),
      this.handleLayerGroupChanged_, false, this);
  goog.events.listen(this, ol.Object.getChangeEventType(ol.MapProperty.VIEW),
      this.handleViewChanged_, false, this);
  goog.events.listen(this, ol.Object.getChangeEventType(ol.MapProperty.SIZE),
      this.handleSizeChanged_, false, this);
  goog.events.listen(this, ol.Object.getChangeEventType(ol.MapProperty.TARGET),
      this.handleTargetChanged_, false, this);

  // setValues will trigger the rendering of the map if the map
  // is "defined" already.
  this.setValues(optionsInternal.values);

  this.controls_.forEach(
      /**
       * @param {ol.control.Control} control Control.
       */
      function(control) {
        control.setMap(this);
      }, this);

  this.interactions_.forEach(
      /**
       * @param {ol.interaction.Interaction} interaction Interaction.
       */
      function(interaction) {
        interaction.setMap(this);
      }, this);

  this.overlays_.forEach(
      /**
       * @param {ol.Overlay} overlay Overlay.
       */
      function(overlay) {
        overlay.setMap(this);
      }, this);

};
goog.inherits(ol.Map, ol.Object);


/**
 * Add the given control to the map.
 * @param {ol.control.Control} control Control.
 * @todo stability experimental
 */
ol.Map.prototype.addControl = function(control) {
  var controls = this.getControls();
  goog.asserts.assert(goog.isDef(controls));
  controls.push(control);
  control.setMap(this);
};


/**
 * Add the given interaction to the map.
 * @param {ol.interaction.Interaction} interaction Interaction to add.
 */
ol.Map.prototype.addInteraction = function(interaction) {
  var interactions = this.getInteractions();
  goog.asserts.assert(goog.isDef(interactions));
  interactions.push(interaction);
  interaction.setMap(this);
};


/**
 * Adds the given layer to the top of this map.
 * @param {ol.layer.Base} layer Layer.
 * @todo stability experimental
 */
ol.Map.prototype.addLayer = function(layer) {
  var layers = this.getLayerGroup().getLayers();
  goog.asserts.assert(goog.isDef(layers));
  layers.push(layer);
};


/**
 * Add the given overlay to the map.
 * @param {ol.Overlay} overlay Overlay.
 * @todo stability experimental
 */
ol.Map.prototype.addOverlay = function(overlay) {
  var overlays = this.getOverlays();
  goog.asserts.assert(goog.isDef(overlays));
  overlays.push(overlay);
  overlay.setMap(this);
};


/**
 * Add functions to be called before rendering. This can be used for attaching
 * animations before updating the map's view.  The {@link ol.animation}
 * namespace provides several static methods for creating prerender functions.
 * @param {...ol.PreRenderFunction} var_args Any number of pre-render functions.
 * @todo stability experimental
 */
ol.Map.prototype.beforeRender = function(var_args) {
  this.requestRenderFrame();
  Array.prototype.push.apply(this.preRenderFunctions_, arguments);
};


/**
 * @param {ol.PreRenderFunction} preRenderFunction Pre-render function.
 * @return {boolean} Whether the preRenderFunction has been found and removed.
 */
ol.Map.prototype.removePreRenderFunction = function(preRenderFunction) {
  return goog.array.remove(this.preRenderFunctions_, preRenderFunction);
};


/**
 *
 * @inheritDoc
 */
ol.Map.prototype.disposeInternal = function() {
  goog.dom.removeNode(this.viewport_);
  goog.base(this, 'disposeInternal');
};


/**
 * Freeze rendering.
 */
ol.Map.prototype.freezeRendering = function() {
  ++this.freezeRenderingCount_;
};


/**
 * Returns the geographical coordinate for a browser event.
 * @param {Event} event Event.
 * @return {ol.Coordinate} Coordinate.
 * @todo stability experimental
 */
ol.Map.prototype.getEventCoordinate = function(event) {
  return this.getCoordinateFromPixel(this.getEventPixel(event));
};


/**
 * Returns the map pixel position for a browser event.
 * @param {Event} event Event.
 * @return {ol.Pixel} Pixel.
 * @todo stability experimental
 */
ol.Map.prototype.getEventPixel = function(event) {
  // goog.style.getRelativePosition is based on event.targetTouches,
  // but touchend and touchcancel events have no targetTouches when
  // the last finger is removed from the screen.
  // So we ourselves compute the position of touch events.
  // See https://code.google.com/p/closure-library/issues/detail?id=588
  if (goog.isDef(event.changedTouches)) {
    var touch = event.changedTouches.item(0);
    var viewportPosition = goog.style.getClientPosition(this.viewport_);
    return [
      touch.clientX - viewportPosition.x,
      touch.clientY - viewportPosition.y
    ];
  } else {
    var eventPosition = goog.style.getRelativePosition(event, this.viewport_);
    return [eventPosition.x, eventPosition.y];
  }
};


/**
 * Get the map's renderer.
 * @return {ol.renderer.Map} Renderer.
 * @todo stability experimental
 */
ol.Map.prototype.getRenderer = function() {
  return this.renderer_;
};


/**
 * Get the target in which this map is rendered.
 * Note that this returns what is entered as an option or in setTarget:
 * if that was an element, it returns an element; if a string, it returns that.
 * @return {Element|string|undefined} Target.
 * @todo stability experimental
 */
ol.Map.prototype.getTarget = function() {
  return /** @type {Element|string|undefined} */ (
      this.get(ol.MapProperty.TARGET));
};
goog.exportProperty(
    ol.Map.prototype,
    'getTarget',
    ol.Map.prototype.getTarget);


/**
 * @param {ol.Pixel} pixel Pixel.
 * @return {ol.Coordinate} Coordinate.
 */
ol.Map.prototype.getCoordinateFromPixel = function(pixel) {
  var frameState = this.frameState_;
  if (goog.isNull(frameState)) {
    return null;
  } else {
    var vec2 = pixel.slice();
    return ol.vec.Mat4.multVec2(frameState.pixelToCoordinateMatrix, vec2, vec2);
  }
};


/**
 * @return {ol.Collection} Controls.
 * @todo stability experimental
 */
ol.Map.prototype.getControls = function() {
  return this.controls_;
};


/**
 * @return {ol.Collection} Overlays.
 * @todo stability experimental
 */
ol.Map.prototype.getOverlays = function() {
  return this.overlays_;
};


/**
 * Get feature information for a pixel on the map.
 *
 * @param {ol.GetFeatureInfoOptions} options Options.
 * @todo stability experimental
 */
ol.Map.prototype.getFeatureInfo = function(options) {
  var layers = goog.isDefAndNotNull(options.layers) ?
      options.layers : this.getLayerGroup().getLayersArray();
  this.getRenderer().getFeatureInfoForPixel(
      options.pixel, layers, options.success, options.error);
};


/**
 * Get features for a pixel on the map.
 *
 * @param {ol.GetFeaturesOptions} options Options.
 * @todo stability experimental
 */
ol.Map.prototype.getFeatures = function(options) {
  var layers = goog.isDefAndNotNull(options.layers) ?
      options.layers : this.getLayerGroup().getLayersArray();
  this.getRenderer().getFeaturesForPixel(
      options.pixel, layers, options.success, options.error);
};


/**
 * Gets the collection of
 * {@link ol.interaction|ol.interaction.Interaction} instances
 * associated with this map.  Modifying this collection
 * changes the interactions associated with the map.
 *
 * Interactions are used for e.g. pan, zoom and rotate.
 * @return {ol.Collection} Interactions.
 * @todo stability experimental
 */
ol.Map.prototype.getInteractions = function() {
  return this.interactions_;
};


/**
 * Get the layergroup associated with this map.
 * @return {ol.layer.Group} LayerGroup.
 * @todo stability experimental
 */
ol.Map.prototype.getLayerGroup = function() {
  return /** @type {ol.layer.Group} */ (
      this.get(ol.MapProperty.LAYERGROUP));
};
goog.exportProperty(
    ol.Map.prototype,
    'getLayerGroup',
    ol.Map.prototype.getLayerGroup);


/**
 * Get the collection of layers associated with this map.
 * @return {ol.Collection} Layers.
 * @todo stability experimental
 */
ol.Map.prototype.getLayers = function() {
  return this.getLayerGroup().getLayers();
};


/**
 * @param {ol.Coordinate} coordinate Coordinate.
 * @return {ol.Pixel} Pixel.
 */
ol.Map.prototype.getPixelFromCoordinate = function(coordinate) {
  var frameState = this.frameState_;
  if (goog.isNull(frameState)) {
    return null;
  } else {
    var vec2 = coordinate.slice(0, 2);
    return ol.vec.Mat4.multVec2(frameState.coordinateToPixelMatrix, vec2, vec2);
  }
};


/**
 * Get the size of this map.
 * @return {ol.Size|undefined} Size.
 * @todo stability experimental
 */
ol.Map.prototype.getSize = function() {
  return /** @type {ol.Size|undefined} */ (this.get(ol.MapProperty.SIZE));
};
goog.exportProperty(
    ol.Map.prototype,
    'getSize',
    ol.Map.prototype.getSize);


/**
 * Get the view associated with this map. This can be a 2D or 3D view. A 2D
 * view manages properties such as center and resolution.
 * @return {ol.View} View.
 * @todo stability experimental
 */
ol.Map.prototype.getView = function() {
  return /** @type {ol.View} */ (this.get(ol.MapProperty.VIEW));
};
goog.exportProperty(
    ol.Map.prototype,
    'getView',
    ol.Map.prototype.getView);


/**
 * @return {Element} Viewport.
 * @todo stability experimental
 */
ol.Map.prototype.getViewport = function() {
  return this.viewport_;
};


/**
 * @return {Element} The map's overlay container. Elements added to this
 * container will let mousedown and touchstart events through to the map, so
 * clicks and gestures on an overlay will trigger MapBrowserEvent events.
 */
ol.Map.prototype.getOverlayContainer = function() {
  return this.overlayContainer_;
};


/**
 * @return {Element} The map's overlay container. Elements added to this
 * container won't let mousedown and touchstart events through to the map, so
 * clicks and gestures on an overlay don't trigger any MapBrowserEvent.
 */
ol.Map.prototype.getOverlayContainerStopEvent = function() {
  return this.overlayContainerStopEvent_;
};


/**
 * @param {ol.Tile} tile Tile.
 * @param {string} tileSourceKey Tile source key.
 * @param {ol.Coordinate} tileCenter Tile center.
 * @param {number} tileResolution Tile resolution.
 * @return {number} Tile priority.
 */
ol.Map.prototype.getTilePriority =
    function(tile, tileSourceKey, tileCenter, tileResolution) {
  // Filter out tiles at higher zoom levels than the current zoom level, or that
  // are outside the visible extent.
  var frameState = this.frameState_;
  if (goog.isNull(frameState) || !(tileSourceKey in frameState.wantedTiles)) {
    return ol.structs.PriorityQueue.DROP;
  }
  var coordKey = tile.tileCoord.toString();
  if (!frameState.wantedTiles[tileSourceKey][coordKey]) {
    return ol.structs.PriorityQueue.DROP;
  }
  // Prioritize the highest zoom level tiles closest to the focus.
  // Tiles at higher zoom levels are prioritized using Math.log(tileResolution).
  // Within a zoom level, tiles are prioritized by the distance in pixels
  // between the center of the tile and the focus.  The factor of 65536 means
  // that the prioritization should behave as desired for tiles up to
  // 65536 * Math.log(2) = 45426 pixels from the focus.
  var deltaX = tileCenter[0] - frameState.focus[0];
  var deltaY = tileCenter[1] - frameState.focus[1];
  return 65536 * Math.log(tileResolution) +
      Math.sqrt(deltaX * deltaX + deltaY * deltaY) / tileResolution;
};


/**
 * @param {goog.events.BrowserEvent} browserEvent Browser event.
 * @param {string=} opt_type Type.
 */
ol.Map.prototype.handleBrowserEvent = function(browserEvent, opt_type) {
  var type = opt_type || browserEvent.type;
  var mapBrowserEvent = new ol.MapBrowserEvent(type, this, browserEvent);
  this.handleMapBrowserEvent(mapBrowserEvent);
};


/**
 * @param {ol.MapBrowserEvent} mapBrowserEvent The event to handle.
 */
ol.Map.prototype.handleMapBrowserEvent = function(mapBrowserEvent) {
  if (goog.isNull(this.frameState_)) {
    // With no view defined, we cannot translate pixels into geographical
    // coordinates so interactions cannot be used.
    return;
  }
  this.focus_ = mapBrowserEvent.getCoordinate();
  mapBrowserEvent.frameState = this.frameState_;
  var interactions = this.getInteractions();
  var interactionsArray = /** @type {Array.<ol.interaction.Interaction>} */
      (interactions.getArray());
  var i;
  if (this.dispatchEvent(mapBrowserEvent) !== false) {
    for (i = interactionsArray.length - 1; i >= 0; i--) {
      var interaction = interactionsArray[i];
      var cont = interaction.handleMapBrowserEvent(mapBrowserEvent);
      if (!cont) {
        break;
      }
    }
  }
};


/**
 * @protected
 */
ol.Map.prototype.handlePostRender = function() {

  var frameState = this.frameState_;

  // Manage the tile queue
  // Image loads are expensive and a limited resource, so try to use them
  // efficiently:
  // * When the view is static we allow a large number of parallel tile loads
  //   to complete the frame as quickly as possible.
  // * When animating or interacting, image loads can cause janks, so we reduce
  //   the maximum number of loads per frame and limit the number of parallel
  //   tile loads to remain reactive to view changes and to reduce the chance of
  //   loading tiles that will quickly disappear from view.
  var tileQueue = this.tileQueue_;
  if (!tileQueue.isEmpty()) {
    var maxTotalLoading = 16;
    var maxNewLoads = maxTotalLoading;
    var tileSourceCount = 0;
    if (!goog.isNull(frameState)) {
      var hints = frameState.viewHints;
      if (hints[ol.ViewHint.ANIMATING] || hints[ol.ViewHint.INTERACTING]) {
        maxTotalLoading = 8;
        maxNewLoads = 2;
      }
      tileSourceCount = goog.object.getCount(frameState.wantedTiles);
    }
    maxTotalLoading *= tileSourceCount;
    maxNewLoads *= tileSourceCount;
    if (tileQueue.getTilesLoading() < maxTotalLoading) {
      tileQueue.reprioritize(); // FIXME only call if view has changed
      tileQueue.loadMoreTiles(maxTotalLoading, maxNewLoads);
    }
  }

  var postRenderFunctions = this.postRenderFunctions_;
  var i, ii;
  for (i = 0, ii = postRenderFunctions.length; i < ii; ++i) {
    postRenderFunctions[i](this, frameState);
  }
  postRenderFunctions.length = 0;
};


/**
 * @private
 */
ol.Map.prototype.handleSizeChanged_ = function() {
  this.render();
};


/**
 * @private
 */
ol.Map.prototype.handleTargetChanged_ = function() {
  // target may be undefined, null, a string or an Element.
  // If it's a string we convert it to an Element before proceeding.
  // If it's not now an Element we remove the viewport from the DOM.
  // If it's an Element we append the viewport element to it.

  var target = this.getTarget();

  /**
   * @type {Element}
   */
  var targetElement = goog.isDef(target) ?
      goog.dom.getElement(target) : null;

  this.keyHandler_.detach();

  if (goog.isNull(targetElement)) {
    goog.dom.removeNode(this.viewport_);
  } else {
    goog.dom.appendChild(targetElement, this.viewport_);

    // The key handler is attached to the user-provided target. So the key
    // handler will only trigger events when the target element is focused
    // (requiring that the target element has a tabindex attribute).
    this.keyHandler_.attach(targetElement);
  }

  this.updateSize();
  // updateSize calls setSize, so no need to call this.render
  // ourselves here.
};


/**
 * @private
 */
ol.Map.prototype.handleTileChange_ = function() {
  this.requestRenderFrame();
};


/**
 * @private
 */
ol.Map.prototype.handleViewPropertyChanged_ = function() {
  this.render();
};


/**
 * @private
 */
ol.Map.prototype.handleViewChanged_ = function() {
  if (!goog.isNull(this.viewPropertyListenerKey_)) {
    goog.events.unlistenByKey(this.viewPropertyListenerKey_);
    this.viewPropertyListenerKey_ = null;
  }
  var view = this.getView();
  if (goog.isDefAndNotNull(view)) {
    this.viewPropertyListenerKey_ = goog.events.listen(
        view, ol.ObjectEventType.CHANGE,
        this.handleViewPropertyChanged_, false, this);
  }
  this.render();
};


/**
 * @param {goog.events.Event} event Event.
 * @private
 */
ol.Map.prototype.handleLayerGroupPropertyChanged_ = function(event) {
  this.render();
};


/**
 * @private
 */
ol.Map.prototype.handleLayerGroupChanged_ = function() {
  if (!goog.isNull(this.layerGroupPropertyListenerKey_)) {
    goog.events.unlistenByKey(this.layerGroupPropertyListenerKey_);
    this.layerGroupPropertyListenerKey_ = null;
  }
  var layerGroup = this.getLayerGroup();
  if (goog.isDefAndNotNull(layerGroup)) {
    this.layerGroupPropertyListenerKey_ = goog.events.listen(
        layerGroup, ol.ObjectEventType.CHANGE,
        this.handleLayerGroupPropertyChanged_, false, this);
  }
  this.render();
};


/**
 * @return {boolean} Is defined.
 */
ol.Map.prototype.isDef = function() {
  var view = this.getView();
  return goog.isDef(view) && view.isDef() &&
      goog.isDefAndNotNull(this.getSize());
};


/**
 * Render.
 */
ol.Map.prototype.render = function() {
  if (this.animationDelay_.isActive()) {
    // pass
  } else if (this.freezeRenderingCount_ === 0) {
    this.animationDelay_.fire();
  } else {
    this.dirty_ = true;
  }
};


/**
 * Request that renderFrame_ be called some time in the future.
 */
ol.Map.prototype.requestRenderFrame = function() {
  if (this.freezeRenderingCount_ === 0) {
    if (!this.animationDelay_.isActive()) {
      this.animationDelay_.start();
    }
  } else {
    this.dirty_ = true;
  }
};


/**
 * Remove the given control from the map.
 * @param {ol.control.Control} control Control.
 * @return {ol.control.Control|undefined} The removed control of undefined
 *     if the control was not found.
 * @todo stability experimental
 */
ol.Map.prototype.removeControl = function(control) {
  var controls = this.getControls();
  goog.asserts.assert(goog.isDef(controls));
  if (goog.isDef(controls.remove(control))) {
    control.setMap(null);
    return control;
  }
  return undefined;
};


/**
 * Remove the given interaction from the map.
 * @param {ol.interaction.Interaction} interaction Interaction to remove.
 * @return {ol.interaction.Interaction|undefined} The removed interaction (or
 *     undefined if the interaction was not found).
 */
ol.Map.prototype.removeInteraction = function(interaction) {
  var removed;
  var interactions = this.getInteractions();
  goog.asserts.assert(goog.isDef(interactions));
  if (goog.isDef(interactions.remove(interaction))) {
    interaction.setMap(null);
    removed = interaction;
  }
  return removed;
};


/**
 * Removes the given layer from the map.
 * @param {ol.layer.Base} layer Layer.
 * @return {ol.layer.Base|undefined} The removed layer or undefined if the
 *     layer was not found.
 * @todo stability experimental
 */
ol.Map.prototype.removeLayer = function(layer) {
  var layers = this.getLayerGroup().getLayers();
  goog.asserts.assert(goog.isDef(layers));
  return /** @type {ol.layer.Base|undefined} */ (layers.remove(layer));
};


/**
 * Remove the given overlay from the map.
 * @param {ol.Overlay} overlay Overlay.
 * @return {ol.Overlay|undefined} The removed overlay of undefined
 *     if the overlay was not found.
 * @todo stability experimental
 */
ol.Map.prototype.removeOverlay = function(overlay) {
  var overlays = this.getOverlays();
  goog.asserts.assert(goog.isDef(overlays));
  if (goog.isDef(overlays.remove(overlay))) {
    overlay.setMap(null);
    return overlay;
  }
  return undefined;
};


/**
 * @param {number} time Time.
 * @private
 */
ol.Map.prototype.renderFrame_ = function(time) {

  var i, ii, view2DState;

  if (this.freezeRenderingCount_ !== 0) {
    return;
  }

  var size = this.getSize();
  var view = this.getView();
  var view2D = goog.isDef(view) ? this.getView().getView2D() : undefined;
  /** @type {?ol.FrameState} */
  var frameState = null;
  if (goog.isDef(size) && goog.isDef(view2D) && view2D.isDef()) {
    var viewHints = view.getHints();
    var obj = this.getLayerGroup().getLayerStatesArray();
    var layersArray = obj.layers;
    var layerStatesArray = obj.layerStates;
    var layerStates = {};
    var layer;
    for (i = 0, ii = layersArray.length; i < ii; ++i) {
      layer = layersArray[i];
      layerStates[goog.getUid(layer)] = layerStatesArray[i];
    }
    view2DState = view2D.getView2DState();
    frameState = {
      animate: false,
      attributions: {},
      coordinateToPixelMatrix: this.coordinateToPixelMatrix_,
      extent: null,
      focus: goog.isNull(this.focus_) ? view2DState.center : this.focus_,
      index: this.frameIndex_++,
      layersArray: layersArray,
      layerStates: layerStates,
      logos: {},
      pixelToCoordinateMatrix: this.pixelToCoordinateMatrix_,
      postRenderFunctions: [],
      size: size,
      tileQueue: this.tileQueue_,
      time: time,
      usedTiles: {},
      view2DState: view2DState,
      viewHints: viewHints,
      wantedTiles: {}
    };
  }

  var preRenderFunctions = this.preRenderFunctions_;
  var n = 0, preRenderFunction;
  for (i = 0, ii = preRenderFunctions.length; i < ii; ++i) {
    preRenderFunction = preRenderFunctions[i];
    if (preRenderFunction(this, frameState)) {
      preRenderFunctions[n++] = preRenderFunction;
    }
  }
  preRenderFunctions.length = n;

  if (!goog.isNull(frameState)) {
    // FIXME works for View2D only
    frameState.extent = ol.extent.getForView2DAndSize(view2DState.center,
        view2DState.resolution, view2DState.rotation, frameState.size);
  }

  this.frameState_ = frameState;
  this.renderer_.renderFrame(frameState);
  this.dirty_ = false;

  if (!goog.isNull(frameState)) {
    if (frameState.animate) {
      this.requestRenderFrame();
    }
    Array.prototype.push.apply(
        this.postRenderFunctions_, frameState.postRenderFunctions);

    var idle = this.preRenderFunctions_.length == 0 &&
        !frameState.animate &&
        !frameState.viewHints[ol.ViewHint.ANIMATING] &&
        !frameState.viewHints[ol.ViewHint.INTERACTING];

    if (idle) {
      this.dispatchEvent(new ol.MapEvent(ol.MapEventType.MOVEEND, this));
    }
  }

  this.dispatchEvent(
      new ol.MapEvent(ol.MapEventType.POSTRENDER, this, frameState));

  goog.async.nextTick(this.handlePostRender, this);

};


/**
 * Sets the layergroup of this map.
 * @param {ol.layer.Group} layerGroup Layergroup.
 * @todo stability experimental
 */
ol.Map.prototype.setLayerGroup = function(layerGroup) {
  this.set(ol.MapProperty.LAYERGROUP, layerGroup);
};
goog.exportProperty(
    ol.Map.prototype,
    'setLayerGroup',
    ol.Map.prototype.setLayerGroup);


/**
 * Set the size of this map.
 * @param {ol.Size|undefined} size Size.
 * @todo stability experimental
 */
ol.Map.prototype.setSize = function(size) {
  this.set(ol.MapProperty.SIZE, size);
};
goog.exportProperty(
    ol.Map.prototype,
    'setSize',
    ol.Map.prototype.setSize);


/**
 * Set the target element to render this map into.
 * @param {Element|string|undefined} target Target.
 * @todo stability experimental
 */
ol.Map.prototype.setTarget = function(target) {
  this.set(ol.MapProperty.TARGET, target);
};
goog.exportProperty(
    ol.Map.prototype,
    'setTarget',
    ol.Map.prototype.setTarget);


/**
 * Set the view for this map.
 * @param {ol.IView} view View.
 * @todo stability experimental
 */
ol.Map.prototype.setView = function(view) {
  this.set(ol.MapProperty.VIEW, view);
};
goog.exportProperty(
    ol.Map.prototype,
    'setView',
    ol.Map.prototype.setView);


/**
 * Unfreeze rendering.
 */
ol.Map.prototype.unfreezeRendering = function() {
  goog.asserts.assert(this.freezeRenderingCount_ > 0);
  if (--this.freezeRenderingCount_ === 0 && this.dirty_) {
    this.animationDelay_.fire();
  }
};


/**
 * Force a recalculation of the map viewport size.  This should be called when
 * third-party code changes the size of the map viewport.
 * @todo stability experimental
 */
ol.Map.prototype.updateSize = function() {
  var target = this.getTarget();

  /**
   * @type {Element}
   */
  var targetElement = goog.isDef(target) ?
      goog.dom.getElement(target) : null;

  if (goog.isNull(targetElement)) {
    this.setSize(undefined);
  } else {
    var size = goog.style.getSize(targetElement);
    this.setSize([size.width, size.height]);
  }
};


/**
 * @param {function(this: T)} f Function.
 * @param {T=} opt_obj Object.
 * @template T
 */
ol.Map.prototype.withFrozenRendering = function(f, opt_obj) {
  this.freezeRendering();
  try {
    f.call(opt_obj);
  } finally {
    this.unfreezeRendering();
  }
};


/**
 * @typedef {{controls: ol.Collection,
 *            interactions: ol.Collection,
 *            overlays: ol.Collection,
 *            rendererConstructor:
 *                function(new: ol.renderer.Map, Element, ol.Map),
 *            values: Object.<string, *>}}
 */
ol.MapOptionsInternal;


/**
 * @param {ol.MapOptions} options Map options.
 * @return {ol.MapOptionsInternal} Internal map options.
 */
ol.Map.createOptionsInternal = function(options) {

  /**
   * @type {Object.<string, *>}
   */
  var values = {};

  var layerGroup = (options.layers instanceof ol.layer.Group) ?
      options.layers : new ol.layer.Group({layers: options.layers});
  values[ol.MapProperty.LAYERGROUP] = layerGroup;

  values[ol.MapProperty.TARGET] = options.target;

  values[ol.MapProperty.VIEW] = goog.isDef(options.view) ?
      options.view : new ol.View2D();

  /**
   * @type {function(new: ol.renderer.Map, Element, ol.Map)}
   */
  var rendererConstructor = ol.renderer.Map;

  /**
   * @type {Array.<ol.RendererHint>}
   */
  var rendererHints;
  if (goog.isDef(options.renderers)) {
    rendererHints = options.renderers;
  } else if (goog.isDef(options.renderer)) {
    rendererHints = [options.renderer];
  } else {
    rendererHints = ol.DEFAULT_RENDERER_HINTS;
  }

  var n = rendererHints.length;
  var i, rendererHint;
  for (i = 0; i < n; ++i) {
    rendererHint = rendererHints[i];
    if (rendererHint == ol.RendererHint.CANVAS) {
      if (ol.ENABLE_CANVAS && ol.renderer.canvas.SUPPORTED) {
        rendererConstructor = ol.renderer.canvas.Map;
        break;
      }
    } else if (rendererHint == ol.RendererHint.DOM) {
      if (ol.ENABLE_DOM && ol.renderer.dom.SUPPORTED) {
        rendererConstructor = ol.renderer.dom.Map;
        break;
      }
    } else if (rendererHint == ol.RendererHint.WEBGL) {
      if (ol.ENABLE_WEBGL && ol.renderer.webgl.SUPPORTED) {
        rendererConstructor = ol.renderer.webgl.Map;
        break;
      }
    }
  }

  var controls;
  if (goog.isDef(options.controls)) {
    if (goog.isArray(options.controls)) {
      controls = new ol.Collection(goog.array.clone(options.controls));
    } else {
      goog.asserts.assertInstanceof(options.controls, ol.Collection);
      controls = options.controls;
    }
  } else {
    controls = ol.control.defaults();
  }

  var interactions;
  if (goog.isDef(options.interactions)) {
    if (goog.isArray(options.interactions)) {
      interactions = new ol.Collection(goog.array.clone(options.interactions));
    } else {
      goog.asserts.assertInstanceof(options.interactions, ol.Collection);
      interactions = options.interactions;
    }
  } else {
    interactions = ol.interaction.defaults();
  }

  var overlays;
  if (goog.isDef(options.overlays)) {
    if (goog.isArray(options.overlays)) {
      overlays = new ol.Collection(goog.array.clone(options.overlays));
    } else {
      goog.asserts.assertInstanceof(options.overlays, ol.Collection);
      overlays = options.overlays;
    }
  } else {
    overlays = new ol.Collection();
  }

  return {
    controls: controls,
    interactions: interactions,
    overlays: overlays,
    rendererConstructor: rendererConstructor,
    values: values
  };

};


/**
 * @param {goog.Uri.QueryData=} opt_queryData Query data.
 * @return {Array.<ol.RendererHint>} Renderer hints.
 */
ol.RendererHints.createFromQueryData = function(opt_queryData) {
  var query = goog.global.location.search.substring(1),
      queryData = goog.isDef(opt_queryData) ?
          opt_queryData : new goog.Uri.QueryData(query);
  if (queryData.containsKey('renderers')) {
    return queryData.get('renderers').split(',');
  } else if (queryData.containsKey('renderer')) {
    return [queryData.get('renderer')];
  } else {
    return ol.DEFAULT_RENDERER_HINTS;
  }
};


ol.proj.common.add();


if (goog.DEBUG) {
  (function() {
    goog.debug.Console.autoInstall();
    var logger = goog.log.getLogger('ol');
    logger.setLevel(goog.log.Level.FINEST);
  })();
}

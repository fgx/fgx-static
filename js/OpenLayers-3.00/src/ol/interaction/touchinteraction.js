
goog.provide('ol.interaction.Touch');

goog.require('goog.asserts');
goog.require('goog.functions');
goog.require('goog.object');
goog.require('ol.MapBrowserEvent');
goog.require('ol.MapBrowserEvent.EventType');
goog.require('ol.Pixel');
goog.require('ol.ViewHint');
goog.require('ol.interaction.Interaction');



/**
 * Base class for touch interactions.
 * @constructor
 * @extends {ol.interaction.Interaction}
 */
ol.interaction.Touch = function() {

  goog.base(this);

  /**
   * @type {boolean}
   * @private
   */
  this.handled_ = false;

  /**
   * @type {Object}
   * @private
   */
  this.trackedTouches_ = {};

  /**
   * @type {Array.<Object>}
   * @protected
   */
  this.targetTouches = [];

};
goog.inherits(ol.interaction.Touch, ol.interaction.Interaction);


/**
 * @param {Array.<Object>} touches TouchEvents.
 * @return {ol.Pixel} Centroid pixel.
 */
ol.interaction.Touch.centroid = function(touches) {
  var length = touches.length;
  var clientX = 0;
  var clientY = 0;
  for (var i = 0; i < length; i++) {
    clientX += touches[i].clientX;
    clientY += touches[i].clientY;
  }
  return [clientX / length, clientY / length];
};


/**
 * @param {ol.MapBrowserEvent} mapBrowserEvent Event.
 * @return {boolean} Whether the event is a touchstart, touchmove
 *     or touchend event.
 * @private
 */
ol.interaction.Touch.isTouchEvent_ = function(mapBrowserEvent) {
  var type = mapBrowserEvent.type;
  return (
      type === ol.MapBrowserEvent.EventType.TOUCHSTART ||
      type === ol.MapBrowserEvent.EventType.TOUCHMOVE ||
      type === ol.MapBrowserEvent.EventType.TOUCHEND);
};


/**
 * @param {ol.MapBrowserEvent} mapBrowserEvent Event.
 * @private
 */
ol.interaction.Touch.prototype.updateTrackedTouches_ =
    function(mapBrowserEvent) {
  if (ol.interaction.Touch.isTouchEvent_(mapBrowserEvent)) {
    var event = mapBrowserEvent.browserEvent.getBrowserEvent();
    if (goog.isDef(event.targetTouches)) {
      // W3C touch events
      this.targetTouches = event.targetTouches;
    } else if (goog.isDef(event.pointerId)) {
      // IE pointer event
      if (mapBrowserEvent.type == ol.MapBrowserEvent.EventType.TOUCHEND) {
        delete this.trackedTouches_[event.pointerId];
      } else {
        this.trackedTouches_[event.pointerId] = event;
      }
      this.targetTouches = goog.object.getValues(this.trackedTouches_);
    } else {
      goog.asserts.fail('unknown touch event model');
    }
  }
};


/**
 * @param {ol.MapBrowserEvent} mapBrowserEvent Event.
 * @protected
 */
ol.interaction.Touch.prototype.handleTouchMove = goog.nullFunction;


/**
 * @param {ol.MapBrowserEvent} mapBrowserEvent Event.
 * @protected
 * @return {boolean} Capture dragging.
 */
ol.interaction.Touch.prototype.handleTouchEnd = goog.functions.FALSE;


/**
 * @param {ol.MapBrowserEvent} mapBrowserEvent Event.
 * @protected
 * @return {boolean} Capture dragging.
 */
ol.interaction.Touch.prototype.handleTouchStart = goog.functions.FALSE;


/**
 * @inheritDoc
 */
ol.interaction.Touch.prototype.handleMapBrowserEvent =
    function(mapBrowserEvent) {
  var view = mapBrowserEvent.map.getView();
  this.updateTrackedTouches_(mapBrowserEvent);
  if (this.handled_) {
    if (mapBrowserEvent.type == ol.MapBrowserEvent.EventType.TOUCHMOVE) {
      this.handleTouchMove(mapBrowserEvent);
    } else if (mapBrowserEvent.type == ol.MapBrowserEvent.EventType.TOUCHEND) {
      this.handled_ = this.handleTouchEnd(mapBrowserEvent);
      if (!this.handled_) {
        view.setHint(ol.ViewHint.INTERACTING, -1);
      }
    }
  }
  if (mapBrowserEvent.type == ol.MapBrowserEvent.EventType.TOUCHSTART) {
    var handled = this.handleTouchStart(mapBrowserEvent);
    if (!this.handled_ && handled) {
      view.setHint(ol.ViewHint.INTERACTING, 1);
    }
    this.handled_ = handled;
  }
  return true;
};

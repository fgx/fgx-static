goog.provide('ol.test.geom.LinearRing');

describe('ol.geom.LinearRing', function() {

  describe('constructor', function() {

    it('creates a ring from an array', function() {
      var ring = new ol.geom.LinearRing([[10, 20], [30, 40]]);
      expect(ring).to.be.a(ol.geom.LinearRing);
    });

  });

  describe('#getCoordinates()', function() {

    it('is an array', function() {
      var ring = new ol.geom.LinearRing([[10, 20], [30, 40]]);
      expect(ring.getCoordinates()).to.eql([[10, 20], [30, 40]]);
    });

  });

  describe('#containsCoordinate()', function() {

    it('knows when a point coordinate is inside a ring', function() {
      /**
       *  The ring:
       *                      edge 3
       *          (5, 10)  __________ (15, 10)
       *                 /         /
       *        edge 4 /         / edge 2
       *             /         /
       *    (0, 0) /_________/ (10, 0)
       *             edge 1
       */
      var ring = new ol.geom.LinearRing(
          [[0, 0], [10, 0], [15, 10], [5, 10]]);

      // contains: 1 (touches - not implemented), true (within), false (outside)
      var cases = [{
        point: [5, 5], contains: true
      }, {
        point: [20, 20], contains: false
      }, {
        point: [15, 15], contains: false
      }/*, {
        point: [0, 0], contains: 1 // lower left corner
      }, {
        point: [10, 0], contains: 1 // lower right corner
      }, {
        point: [15, 10], contains: 1 // upper right corner
      }, {
        point: [5, 10], contains: 1 // upper left corner
      }, {
        point: [5, 0], contains: 1 // on edge 1
      }*/, {
        point: [5, -0.1], contains: false // below edge 1
      }, {
        point: [5, 0.1], contains: true // above edge 1
      }/*, {
        point: [12.5, 5], contains: 1 // on edge 2
      }*/, {
        point: [12.4, 5], contains: true // left of edge 2
      }, {
        point: [12.6, 5], contains: false // right of edge 2
      }/*, {
        point: [10, 10], contains: 1 // on edge 3
      }*/, {
        point: [10, 9.9], contains: true // below edge 3
      }, {
        point: [10, 10.1], contains: false // above edge 3
      }/*, {
        point: [2.5, 5], contains: 1 // on edge 4
      }*/, {
        point: [2.4, 5], contains: false // left of edge 4
      }, {
        point: [2.6, 5], contains: true // right of edge 4
      }];

      var c;
      for (var i = 0, ii = cases.length; i < ii; ++i) {
        c = cases[i];
        expect(ring.containsCoordinate(c.point)).to.be(c.contains);
      }
    });
  });

});

describe('ol.geom.LinearRing.isClockwise()', function() {

  var isClockwise = ol.geom.LinearRing.isClockwise;

  it('returns true for clockwise coordinates', function() {
    var coordinates = [
      [0, 0], [0, 1], [1, 1], [1, 0], [0, 0]
    ];
    expect(isClockwise(coordinates)).to.be(true);
  });

  it('returns false for counter-clockwise coordinates', function() {
    var coordinates = [
      [0, 0], [1, 0], [1, 1], [0, 1], [0, 0]
    ];
    expect(isClockwise(coordinates)).to.be(false);
  });

  it('returns true for mostly clockwise, self-intersecting ring', function() {
    var coordinates = [
      [0, 0], [0, 1], [1.5, 1], [1.5, 1.5], [1, 1.5], [1, 0], [0, 0]
    ];
    expect(isClockwise(coordinates)).to.be(true);
  });

  it('returns false for mostly counter-clockwise, intersecting', function() {
    var coordinates = [
      [0, 0], [1, 0], [1, 1.5], [1.5, 1.5], [1.5, 1], [0, 1], [0, 0]
    ];
    expect(isClockwise(coordinates)).to.be(false);
  });

});


goog.require('ol.geom.LinearRing');

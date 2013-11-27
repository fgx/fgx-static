goog.provide('ol.test.style.LineLiteral');

describe('ol.style.LineLiteral', function() {

  describe('#equals()', function() {

    it('identifies equal literals', function() {
      var literal = new ol.style.LineLiteral({
        width: 3,
        color: '#BADA55',
        opacity: 1,
        zIndex: 0
      });
      var equalLiteral = new ol.style.LineLiteral({
        color: '#BADA55',
        width: 3,
        opacity: 1,
        zIndex: 0
      });
      var differentColor = new ol.style.LineLiteral({
        width: 3,
        color: '#ff0000',
        opacity: 1,
        zIndex: 0
      });
      var differentWidth = new ol.style.LineLiteral({
        width: 3.5,
        color: '#BADA55',
        opacity: 1,
        zIndex: 0
      });
      var differentOpacity = new ol.style.LineLiteral({
        width: 3,
        color: '#BADA55',
        opacity: 0.5,
        zIndex: 0
      });
      var differentZIndex = new ol.style.LineLiteral({
        width: 3,
        color: '#BADA55',
        opacity: 1,
        zIndex: 3
      });
      expect(literal.equals(equalLiteral)).to.be(true);
      expect(literal.equals(differentColor)).to.be(false);
      expect(literal.equals(differentWidth)).to.be(false);
      expect(literal.equals(differentOpacity)).to.be(false);
      expect(literal.equals(differentZIndex)).to.be(false);
    });

  });

});

goog.require('ol.style.LineLiteral');

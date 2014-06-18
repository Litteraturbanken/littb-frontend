describe('authors', function() {
  var rows;
  beforeEach(function() {
    browser.get('http://localhost:9000/#!/forfattare');
    rows = element.all(by.repeater('row in rowByLetter[selectedLetter] || rows | filter:authorFilter'))
    
  })
  it('should show the correct amount of authors', function() {

    rows.then(function() {
      expect(rows.count()).toEqual(360)
    })
    
  });
    
  it('should filter using the input', function() {
    element(by.model('authorFilter')).sendKeys('adel');
    rows.then(function() {
      expect(rows.count()).toEqual(5)
    })
  })

});
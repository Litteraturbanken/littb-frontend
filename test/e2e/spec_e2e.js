(function() {
  describe("authors", function() {
    var rows;
    rows = null;
    beforeEach(function() {
      browser.get("http://localhost:9000/#!/forfattare");
      return rows = element.all(By.repeater("row in rowByLetter[selectedLetter] || rows | filter:authorFilter"));
    });
    return it("should filter using the input", function() {
      element(By.model("authorFilter")).sendKeys("adel");
      return rows.then(function() {
        return expect(rows.count()).toEqual(1);
      });
    });
  });

  describe("works", function() {
    var rows, testFilter;
    rows = null;
    testFilter = function() {};
    beforeEach(function() {
      browser.get("http://localhost:9000/#!/titlar");
      return rows = element.all(By.repeater("row in getSource() | orderBy:sorttuple[0]:sorttuple[1] | filter:{mediatype : mediatypeFilter || ''} | filter:filterTitle | filter:filterAuthor"));
    });
    return it("should filter works using the input", function() {
      var filter;
      filter = element(By.model("filter"));
      filter.sendKeys("constru");
      filter.sendKeys(protractor.Key.ENTER);
      return rows.then(function() {
        return expect(rows.count()).toEqual(1);
      });
    });
  });

  describe("titles", function() {
    var rows, testFilter;
    rows = null;
    testFilter = function() {};
    beforeEach(function() {
      browser.get("http://localhost:9000/#!/titlar?niva=titles");
      return rows = element.all(By.repeater("row in getSource() | orderBy:sorttuple[0]:sorttuple[1] | filter:{mediatype : mediatypeFilter || ''} | filter:filterTitle | filter:filterAuthor"));
    });
    return it("should filter titles using the input", function() {
      var filter;
      filter = element(By.model("filter"));
      filter.sendKeys("psalm");
      filter.sendKeys(protractor.Key.ENTER);
      return rows.then(function() {
        return expect(rows.count()).toEqual(779);
      });
    });
  });

  describe("epubList", function() {
    var rows;
    rows = null;
    beforeEach(function() {
      browser.get("http://localhost:9000/#!/epub");
      return rows = element.all(By.repeater("row in rows | filter:rowFilter | orderBy:sorttuple[0]:sorttuple[1]"));
    });
    return it("should filter using the input", function() {
      var filter;
      filter = element(By.model("filterTxt"));
      filter.sendKeys("nordanf");
      return rows.then(function() {
        return expect(rows.count()).toEqual(1);
      });
    });
  });

  describe("reader", function() {
    var ptor;
    ptor = null;
    beforeEach(function() {
      return ptor = protractor.getInstance();
    });
    it("should change page on click", function() {
      browser.get("http://localhost:9000/#!/forfattare/StrindbergA/titlar/Fadren/sida/3/etext");
      element(By.css(".pager_ctrls a[rel=next]")).click();
      return expect(ptor.getCurrentUrl()).toBe("http://localhost:9000/#!/forfattare/StrindbergA/titlar/Fadren/sida/4/etext");
    });
    return it("should correctly handle pagestep", function() {
      browser.get("http://localhost:9000/#!/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil");
      element(By.css(".pager_ctrls a[rel=next]")).click();
      return expect(ptor.getCurrentUrl()).toBe("http://localhost:9000/#!/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil");
    });
  });

  describe("search", function() {
    var ptor;
    ptor = null;
    beforeEach(function() {
      ptor = protractor.getInstance();
      return browser.get("http://localhost:9000/#!/sok");
    });
    return it("should give search results. ", function() {
      var input, rows;
      input = element(By.model("query"));
      input.sendKeys("kriget är förklarat!");
      input.sendKeys(protractor.Key.ENTER);
      rows = element.all(By.repeater("sent in kwic"));
      return rows.then(function() {
        return expect(rows.count()).toEqual(1);
      });
    });
  });

}).call(this);

//# sourceMappingURL=spec_e2e.js.map

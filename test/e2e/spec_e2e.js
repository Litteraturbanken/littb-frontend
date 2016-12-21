(function() {
  describe("authors", function() {
    var rows;
    rows = null;
    beforeEach(function() {
      browser.get("http://localhost:9000/#!/bibliotek");
      return rows = element.all(By.repeater("author in getAuthorData() | filter:filterAuthor"));
    });
    return it("should filter using the input", function() {
      var filter;
      filter = element(By.model("filter"));
      filter.sendKeys("adel");
      filter.sendKeys(protractor.Key.ENTER);
      return expect(rows.count()).toEqual(1);
    });
  });

  describe("works", function() {
    var rows;
    rows = null;
    beforeEach(function() {
      browser.get("http://localhost:9000/#!/bibliotek");
      return rows = element.all(By.repeater("row in listVisibleTitles() | filter:mediatypeFilter"));
    });
    return it("should filter works using the input", function() {
      var filter;
      filter = element(By.model("filter"));
      filter.sendKeys("constru");
      filter.sendKeys(protractor.Key.ENTER);
      return expect(rows.count()).toEqual(1);
    });
  });

  describe("titles", function() {
    var rows;
    rows = null;
    beforeEach(function() {
      browser.get("http://localhost:9000/#!/bibliotek");
      return rows = element.all(By.repeater("row in all_titles | filter:mediatypeFilter"));
    });
    return it("should filter titles using the input", function() {
      var filter;
      filter = element(By.model("filter"));
      filter.sendKeys("psalm");
      filter.sendKeys(protractor.Key.ENTER);
      return expect(rows.count()).toEqual(768);
    });
  });

  describe("epubList", function() {
    var rows;
    rows = null;
    beforeEach(function() {
      browser.get("http://localhost:9000/#!/epub");
      return rows = element.all(By.repeater("row in rows | filter:rowFilter"));
    });
    return it("should filter using the input", function() {
      var filter;
      filter = element(By.model("filterTxt"));
      filter.sendKeys("nordanf");
      return expect(rows.count()).toEqual(1);
    });
  });

  describe("reader", function() {
    it("should change page on click", function() {
      browser.get("http://localhost:9000/#!/forfattare/StrindbergA/titlar/Fadren/sida/3/etext");
      element(By.css(".pager_ctrls a[rel=next]")).click();
      return expect(browser.getCurrentUrl()).toBe("http://localhost:9000/#!/forfattare/StrindbergA/titlar/Fadren/sida/4/etext");
    });
    return it("should correctly handle pagestep", function() {
      browser.get("http://localhost:9000/#!/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil");
      return element(By.css(".pager_ctrls a[rel=next]")).getAttribute('href').then(function(linkUrl) {
        browser.get(linkUrl);
        return expect(browser.getCurrentUrl()).toBe("http://localhost:9000/#!/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil");
      });
    });
  });

  describe("editor", function() {
    it("should change page on click", function() {
      browser.get("http://localhost:9000/#!/editor/lb238704/ix/3/f");
      return element(By.css(".pager_ctrls a[rel=next]")).getAttribute("href").then(function() {
        element(By.css(".pager_ctrls a[rel=next]")).click();
        expect(browser.getCurrentUrl()).toBe("http://localhost:9000/#!/editor/lb238704/ix/4/f");
        return expect(element(By.css("img.faksimil")).getAttribute("src")).toEqual("http://localhost:9000/txt/lb238704/lb238704_3/lb238704_3_0005.jpeg");
      });
    });
    return it("should correctly handle pagestep", function() {
      browser.get("http://localhost:9000/#!/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil");
      return element(By.css(".pager_ctrls a[rel=next]")).getAttribute('href').then(function(linkUrl) {
        browser.get(linkUrl);
        return expect(browser.getCurrentUrl()).toBe("http://localhost:9000/#!/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil");
      });
    });
  });

  describe("search", function() {
    beforeEach(function() {
      return browser.get("http://localhost:9000/#!/sok");
    });
    return it("should give search results. ", function() {
      var input, rows;
      input = element(By.model("query"));
      input.sendKeys("kriget är förklarat !");
      input.sendKeys(protractor.Key.ENTER);
      rows = element.all(By.css(".sentence"));
      return expect(rows.count()).toEqual(1);
    });
  });

}).call(this);

//# sourceMappingURL=spec_e2e.js.map

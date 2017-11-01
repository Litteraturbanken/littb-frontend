(function() {
  describe("library authors", function() {
    var rows;
    rows = null;
    beforeEach(function() {
      browser.get("http://localhost:9001/bibliotek");
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

  describe("library works", function() {
    var rows;
    rows = null;
    beforeEach(function() {
      browser.get("http://localhost:9001/bibliotek");
      return rows = element.all(By.repeater("row in listVisibleTitles() | filter:mediatypeFilter"));
    });
    it("should filter works using the input", function() {
      var filter;
      filter = element(By.model("filter"));
      filter.sendKeys("constru");
      filter.sendKeys(protractor.Key.ENTER);
      return expect(rows.count()).toEqual(1);
    });
    return it("should link correctly to reading mode", function() {
      return expect(element(By.css("li.link.first li:first-of-type a")).getAttribute("href")).toEqual("http://localhost:9001/forfattare/MartinsonH/titlar/Aniara/sida/5/etext");
    });
  });

  describe("titles", function() {
    var rows;
    rows = null;
    beforeEach(function() {
      browser.get("http://localhost:9001/bibliotek");
      return rows = element.all(By.repeater("row in all_titles | filter:mediatypeFilter"));
    });
    return it("should filter titles using the input", function() {
      var filter;
      filter = element(By.model("filter"));
      filter.sendKeys("psalm");
      filter.sendKeys(protractor.Key.ENTER);
      return expect(rows.count()).toEqual(796);
    });
  });

  describe("epubList", function() {
    var rows;
    rows = null;
    beforeEach(function() {
      browser.get("http://localhost:9001/epub");
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
      browser.get("http://localhost:9001/forfattare/StrindbergA/titlar/Fadren/sida/3/etext");
      return element(By.css(".pager_ctrls a[rel=next]")).getAttribute("href").then(function(linkUrl) {
        return expect(linkUrl).toBe("http://localhost:9001/forfattare/StrindbergA/titlar/Fadren/sida/4/etext");
      });
    });
    return it("should correctly handle pagestep", function() {
      browser.get("http://localhost:9001/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil");
      return element(By.css(".pager_ctrls a[rel=next]")).getAttribute('href').then(function(linkUrl) {
        browser.get(linkUrl);
        return expect(browser.getCurrentUrl()).toBe("http://localhost:9001/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil");
      });
    });
  });

  describe("editor", function() {
    it("should change page on click", function() {
      browser.get("http://localhost:9001/editor/lb238704/ix/3/f");
      return element(By.css(".pager_ctrls a[rel=next]")).getAttribute("href").then(function() {
        element(By.css(".pager_ctrls a[rel=next]")).click();
        expect(browser.getCurrentUrl()).toBe("http://localhost:9001/editor/lb238704/ix/4/f");
        return expect(element(By.css("img.faksimil")).getAttribute("src")).toEqual("http://localhost:9001/txt/lb238704/lb238704_3/lb238704_3_0005.jpeg");
      });
    });
    return it("should correctly handle pagestep", function() {
      browser.get("http://localhost:9001/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil");
      return element(By.css(".pager_ctrls a[rel=next]")).getAttribute('href').then(function(linkUrl) {
        browser.get(linkUrl);
        return expect(browser.getCurrentUrl()).toBe("http://localhost:9001/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil");
      });
    });
  });

  fdescribe("search", function() {
    beforeEach(function() {
      return browser.get("http://localhost:9001/sok");
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

  describe("parts navigation", function() {
    var nextPart, prevPart;
    prevPart = function() {
      return element(By.css(".pager_ctrls a:nth-of-type(1)"));
    };
    nextPart = function() {
      return element(By.css(".pager_ctrls a:nth-of-type(2)"));
    };
    it("should handle parts with parent parts", function() {
      browser.get("http://localhost:9001/forfattare/RydbergV/titlar/Singoalla1885/sida/25/faksimil");
      return expect(prevPart().getAttribute('href')).toBe("http://localhost:9001/forfattare/RydbergV/titlar/Singoalla1885/sida/20/faksimil");
    });
    it("should handle many parts on same page, prev", function() {
      browser.get("http://localhost:9001/forfattare/Anonym/titlar/ABC1746/sida/X/faksimil");
      return expect(prevPart().getAttribute('href')).toBe("http://localhost:9001/forfattare/Anonym/titlar/ABC1746/sida/IX/faksimil");
    });
    it("should handle many parts on same page, next", function() {
      browser.get("http://localhost:9001/forfattare/Anonym/titlar/ABC1746/sida/IX/faksimil");
      return expect(nextPart().getAttribute('href')).toBe("http://localhost:9001/forfattare/Anonym/titlar/ABC1746/sida/X/faksimil");
    });
    return it("should give a prev part despite prev page being between parts", function() {
      browser.get("http://localhost:9001/forfattare/BremerF/titlar/NyaTeckningar5/sida/II/faksimil");
      return expect(prevPart().getAttribute('href')).toBe("http://localhost:9001/forfattare/BremerF/titlar/NyaTeckningar5/sida/244/faksimil");
    });
  });

}).call(this);

//# sourceMappingURL=spec_e2e.js.map

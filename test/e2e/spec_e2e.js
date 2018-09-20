/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const HOST = process.env.LITTB_DOCKER_HOST || "localhost";
const get = url => browser.get(`http://${HOST}:9000` + url);
describe("library authors", function() {
    let rows = null;
    beforeEach(function() {
        get("/bibliotek");
        return rows = element.all(By.repeater("author in getAuthorData() | filter:filterAuthor"));
    });

    return it("should filter using the input", function() {
        const filter = element(By.model("filter"));
        filter.sendKeys("adelb");
        filter.sendKeys(protractor.Key.ENTER);
        return expect(rows.count()).toEqual(1);
    });
});


describe("library works", function() {
    let rows = null;
    beforeEach(function() {
        get("/bibliotek");
        return rows = element.all(By.repeater("row in listVisibleTitles() | filter:mediatypeFilter"));
    });


    it("should filter works using the input", function() {
        const filter = element(By.model("filter"));
        filter.sendKeys("constru");
        filter.sendKeys(protractor.Key.ENTER);
        return expect(rows.count()).toEqual(1);
    });

    return it("should link correctly to reading mode", () => expect(element(By.css("li.link.first li:first-of-type a")).getAttribute("href")).toEqual(`http://${HOST}:9000/forfattare/MartinsonH/titlar/Aniara/sida/5/etext`));
});
    

describe("titles", function() {
    let rows = null;
    beforeEach(function() {
        get("/bibliotek");
        return rows = element.all(By.repeater("row in all_titles | filter:mediatypeFilter"));
    });


    return it("should filter titles using the input", function() {
        const filter = element(By.model("filter"));
        filter.sendKeys("psalm");
        filter.sendKeys(protractor.Key.ENTER);
        return expect(rows.count()).toEqual(811);
    });
});


describe("epubList", function() {
    let rows = null;
    beforeEach(function() {
        get("/epub");
    });


    return it("should filter using the input", function() {
        const filter = element(By.model("filterTxt"));
        filter.sendKeys("nordanf");
        // rows = element.all(By.repeater("row in rows | filter:rowFilter | orderBy:sorttuple[0]:sorttuple[1]"))
        rows = element.all(By.css(".tablerow"))
        return expect(rows.count()).toEqual(1);
    });
});



describe("reader", function() {
    // beforeEach () ->

    it("should change page on click", function() {
        get("/forfattare/StrindbergA/titlar/Fadren/sida/3/etext");
        return element(By.css(".pager_ctrls a[rel=next]")).getAttribute("href").then(linkUrl => expect(linkUrl).toBe(`http://${HOST}:9000/forfattare/StrindbergA/titlar/Fadren/sida/4/etext`));
    });
    
    return it("should correctly handle pagestep", function() {
        get("/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil");

        return element(By.css(".pager_ctrls a[rel=next]")).getAttribute('href').then(function(linkUrl) {
            browser.get(linkUrl);
            return expect(browser.getCurrentUrl()).toBe(`http://${HOST}:9000/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil`);
        });
    });
});


describe("editor", function() {
    // beforeEach () ->

    it("should change page on click", function() {
        get("/editor/lb238704/ix/3/f");

        return element(By.css(".pager_ctrls a[rel=next]")).getAttribute("href").then(function() {
            element(By.css(".pager_ctrls a[rel=next]")).click();
            expect(browser.getCurrentUrl()).toBe(`http://${HOST}:9000/editor/lb238704/ix/4/f`);

            return expect(element(By.css("img.faksimil")).getAttribute("src"))
                .toEqual(`http://${HOST}:9000/txt/lb238704/lb238704_3/lb238704_3_0005.jpeg`);
        });
    });


    
    return it("should correctly handle pagestep", function() {
        get("/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil");
        return element(By.css(".pager_ctrls a[rel=next]")).getAttribute('href').then(function(linkUrl) {
            browser.get(linkUrl);
            return expect(browser.getCurrentUrl()).toBe(`http://${HOST}:9000/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil`);
        });
    });
});


describe("search", function() {
    beforeEach(() => get("/sök"));
        

    return it("should give search results. ", function() {
        const input = element(By.model("query"));
        input.sendKeys("kriget är förklarat !");
        input.sendKeys(protractor.Key.ENTER);

        const rows = element.all(By.css(".sentence"));
        return expect(rows.count()).toEqual(1);
    });
});



describe("parts navigation", function() {
    const prevPart = () => element(By.css(".pager_ctrls a.prev_part"));
    const nextPart = () => element(By.css(".pager_ctrls a.next_part"));
    const currentPartName = () => element(By.css(".current_part .navtitle"));

    it("should handle parts with parent parts", function() {
        get("/forfattare/RydbergV/titlar/Singoalla1885/sida/25/faksimil");
        return expect(prevPart().getAttribute('href')).toBe(`http://${HOST}:9000/forfattare/RydbergV/titlar/Singoalla1885/sida/20/faksimil`);
    });
    
    it("should handle many parts on same page, prev", function() {
        get("/forfattare/Anonym/titlar/ABC1746/sida/X/faksimil");
        return expect(prevPart().getAttribute('href')).toBe(`http://${HOST}:9000/forfattare/Anonym/titlar/ABC1746/sida/IX/faksimil`);
    });

    it("should handle many parts on same page, next", function() {
        get("/forfattare/Anonym/titlar/ABC1746/sida/IX/faksimil");
        return expect(nextPart().getAttribute('href')).toBe(`http://${HOST}:9000/forfattare/Anonym/titlar/ABC1746/sida/X/faksimil`);
    });

    it("should give a prev part despite prev page being between parts", function() {
        get("/forfattare/BremerF/titlar/NyaTeckningar5/sida/II/faksimil");
        return expect(prevPart().getAttribute('href')).toBe(`http://${HOST}:9000/forfattare/BremerF/titlar/NyaTeckningar5/sida/244/faksimil`);
    });
    
    it("should find a single page part on the prev page", function() {
        get("/forfattare/BellmanCM/titlar/BellmanStandardupplagan1/sida/CLXXIII/faksimil");
        return expect(prevPart().getAttribute('href')).toBe(`http://${HOST}:9000/forfattare/BellmanCM/titlar/BellmanStandardupplagan1/sida/CLXXII/faksimil`);
    });

    it("should show current part name instead of ended part", function() {
        get("/forfattare/Euripides/titlar/Elektra1843/sida/9/faksimil");
        return expect(currentPartName().getText()).toBe("[Pjäsen]");
    });

    it("should go to beginning of current part rather than previous part", function() {
        get("/forfattare/SvenskaAkademien/titlar/SvenskaAkademiens4/sida/325/faksimil");
        return expect(prevPart().getAttribute('href')).toBe(`http://${HOST}:9000/forfattare/SvenskaAkademien/titlar/SvenskaAkademiens4/sida/311/faksimil`);
    });

    return it("should disable prev if before first part", function() {
        get("/forfattare/OmarKhayyam/titlar/UmrKhaiyamRubaIyat/sida/1/faksimil");
        return expect(prevPart().getAttribute('class')).toBe('prev_part disabled');
    });
});



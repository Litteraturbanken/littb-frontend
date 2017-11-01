
fdescribe "library authors", () ->
    rows = null
    beforeEach () ->
        browser.get "http://localhost:9001/bibliotek"
        rows = element.all(By.repeater("author in getAuthorData() | filter:filterAuthor"))

    it "should filter using the input", () ->
        filter = element(By.model("filter"))
        filter.sendKeys "adel"
        filter.sendKeys(protractor.Key.ENTER)
        expect(rows.count()).toEqual 1


describe "library works", () ->
    rows = null
    beforeEach () ->
        browser.get "http://localhost:9001/bibliotek"
        rows = element.all(By.repeater("row in listVisibleTitles() | filter:mediatypeFilter"))


    it "should filter works using the input", () ->
        filter = element(By.model("filter"))
        filter.sendKeys("constru")
        filter.sendKeys(protractor.Key.ENTER)
        expect(rows.count()).toEqual 1

    it "should link correctly to reading mode", () ->
        expect(element(By.css "li.link.first li:first-of-type a").getAttribute("href")).toEqual "http://localhost:9001/forfattare/MartinsonH/titlar/Aniara/sida/5/etext"
    

describe "titles", () ->
    rows = null
    beforeEach () ->
        browser.get "http://localhost:9001/bibliotek"
        rows = element.all(By.repeater("row in all_titles | filter:mediatypeFilter"))


    it "should filter titles using the input", () ->
        filter = element(By.model("filter"))
        filter.sendKeys("psalm")
        filter.sendKeys(protractor.Key.ENTER)
        expect(rows.count()).toEqual 796


describe "epubList", () ->
    rows = null
    beforeEach () ->
        browser.get "http://localhost:9001/epub"
        rows = element.all(By.repeater("row in rows | filter:rowFilter"))


    it "should filter using the input", () ->
        filter = element(By.model("filterTxt"))
        filter.sendKeys("nordanf")
        # rows = element.all(By.repeater("row in rows | filter:rowFilter | orderBy:sorttuple[0]:sorttuple[1]"))
        expect(rows.count()).toEqual 1



describe "reader", () ->
    # beforeEach () ->

    it "should change page on click", () ->
        browser.get "http://localhost:9001/forfattare/StrindbergA/titlar/Fadren/sida/3/etext"
        element(By.css ".pager_ctrls a[rel=next]").getAttribute("href").then (linkUrl) ->
            expect(linkUrl).toBe("http://localhost:9001/forfattare/StrindbergA/titlar/Fadren/sida/4/etext")
    
    it "should correctly handle pagestep", () ->
        browser.get "http://localhost:9001/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil"

        element(By.css ".pager_ctrls a[rel=next]").getAttribute('href').then (linkUrl) ->
            browser.get(linkUrl)
            expect(browser.getCurrentUrl()).toBe("http://localhost:9001/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil")


describe "editor", () ->
    # beforeEach () ->

    it "should change page on click", () ->
        browser.get "http://localhost:9001/editor/lb238704/ix/3/f"

        element(By.css ".pager_ctrls a[rel=next]").getAttribute("href").then () ->
            element(By.css ".pager_ctrls a[rel=next]").click()
            expect(browser.getCurrentUrl()).toBe("http://localhost:9001/editor/lb238704/ix/4/f")

            expect(element(By.css "img.faksimil").getAttribute("src"))
                .toEqual("http://localhost:9001/txt/lb238704/lb238704_3/lb238704_3_0005.jpeg")


    
    it "should correctly handle pagestep", () ->
        browser.get "http://localhost:9001/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil"
        element(By.css ".pager_ctrls a[rel=next]").getAttribute('href').then (linkUrl) ->
            browser.get(linkUrl)
            expect(browser.getCurrentUrl()).toBe("http://localhost:9001/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil")


describe "search", () ->
    beforeEach () ->
        browser.get "http://localhost:9001/sok"
        

    it "should give search results. ", () ->
        input = element(By.model "query")
        input.sendKeys("kriget är förklarat !")
        input.sendKeys(protractor.Key.ENTER)

        rows = element.all(By.css(".sentence"))
        expect(rows.count()).toEqual 1



describe "parts navigation", () ->
    prevPart = () -> element(By.css(".pager_ctrls a:nth-of-type(1)"))
    nextPart = () -> element(By.css(".pager_ctrls a:nth-of-type(2)"))

    it "should handle parts with parent parts", () ->
        browser.get "http://localhost:9001/forfattare/RydbergV/titlar/Singoalla1885/sida/25/faksimil"
        expect(prevPart().getAttribute('href')).toBe("http://localhost:9001/forfattare/RydbergV/titlar/Singoalla1885/sida/20/faksimil")
    
    it "should handle many parts on same page, prev", () ->
        browser.get "http://localhost:9001/forfattare/Anonym/titlar/ABC1746/sida/X/faksimil"
        expect(prevPart().getAttribute('href')).toBe("http://localhost:9001/forfattare/Anonym/titlar/ABC1746/sida/IX/faksimil")

    it "should handle many parts on same page, next", () ->
        browser.get "http://localhost:9001/forfattare/Anonym/titlar/ABC1746/sida/IX/faksimil"
        expect(nextPart().getAttribute('href')).toBe("http://localhost:9001/forfattare/Anonym/titlar/ABC1746/sida/X/faksimil")

    it "should give a prev part despite prev page being between parts", () ->
        browser.get "http://localhost:9001/forfattare/BremerF/titlar/NyaTeckningar5/sida/II/faksimil"
        expect(prevPart().getAttribute('href')).toBe("http://localhost:9001/forfattare/BremerF/titlar/NyaTeckningar5/sida/244/faksimil")




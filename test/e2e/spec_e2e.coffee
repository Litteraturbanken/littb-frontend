HOST = process.env.LITTB_DOCKER_HOST or "localhost"
get = (url) ->
    browser.get("http://#{HOST}:9001" + url)
describe "library authors", () ->
    rows = null
    beforeEach () ->
        get "/bibliotek"
        rows = element.all(By.repeater("author in getAuthorData() | filter:filterAuthor"))

    it "should filter using the input", () ->
        filter = element(By.model("filter"))
        filter.sendKeys "adelb"
        filter.sendKeys(protractor.Key.ENTER)
        expect(rows.count()).toEqual 1


describe "library works", () ->
    rows = null
    beforeEach () ->
        get "/bibliotek"
        rows = element.all(By.repeater("row in listVisibleTitles() | filter:mediatypeFilter"))


    it "should filter works using the input", () ->
        filter = element(By.model("filter"))
        filter.sendKeys("constru")
        filter.sendKeys(protractor.Key.ENTER)
        expect(rows.count()).toEqual 1

    it "should link correctly to reading mode", () ->
        expect(element(By.css "li.link.first li:first-of-type a").getAttribute("href")).toEqual "http://#{HOST}:9001/forfattare/MartinsonH/titlar/Aniara/sida/5/etext"
    

describe "titles", () ->
    rows = null
    beforeEach () ->
        get "/bibliotek"
        rows = element.all(By.repeater("row in all_titles | filter:mediatypeFilter"))


    it "should filter titles using the input", () ->
        filter = element(By.model("filter"))
        filter.sendKeys("psalm")
        filter.sendKeys(protractor.Key.ENTER)
        expect(rows.count()).toEqual 810


describe "epubList", () ->
    rows = null
    beforeEach () ->
        get "/epub"
        rows = element.all(By.repeater("row in rows | filter:rowFilter"))


    it "should filter using the input", () ->
        filter = element(By.model("filterTxt"))
        filter.sendKeys("nordanf")
        # rows = element.all(By.repeater("row in rows | filter:rowFilter | orderBy:sorttuple[0]:sorttuple[1]"))
        expect(rows.count()).toEqual 1



describe "reader", () ->
    # beforeEach () ->

    it "should change page on click", () ->
        get "/forfattare/StrindbergA/titlar/Fadren/sida/3/etext"
        element(By.css ".pager_ctrls a[rel=next]").getAttribute("href").then (linkUrl) ->
            expect(linkUrl).toBe("http://#{HOST}:9001/forfattare/StrindbergA/titlar/Fadren/sida/4/etext")
    
    it "should correctly handle pagestep", () ->
        get "/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil"

        element(By.css ".pager_ctrls a[rel=next]").getAttribute('href').then (linkUrl) ->
            browser.get(linkUrl)
            expect(browser.getCurrentUrl()).toBe("http://#{HOST}:9001/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil")


describe "editor", () ->
    # beforeEach () ->

    it "should change page on click", () ->
        get "/editor/lb238704/ix/3/f"

        element(By.css ".pager_ctrls a[rel=next]").getAttribute("href").then () ->
            element(By.css ".pager_ctrls a[rel=next]").click()
            expect(browser.getCurrentUrl()).toBe("http://#{HOST}:9001/editor/lb238704/ix/4/f")

            expect(element(By.css "img.faksimil").getAttribute("src"))
                .toEqual("http://#{HOST}:9001/txt/lb238704/lb238704_3/lb238704_3_0005.jpeg")


    
    it "should correctly handle pagestep", () ->
        get "/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil"
        element(By.css ".pager_ctrls a[rel=next]").getAttribute('href').then (linkUrl) ->
            browser.get(linkUrl)
            expect(browser.getCurrentUrl()).toBe("http://#{HOST}:9001/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil")


describe "search", () ->
    beforeEach () ->
        get "/sök"
        

    it "should give search results. ", () ->
        input = element(By.model "query")
        input.sendKeys("kriget är förklarat !")
        input.sendKeys(protractor.Key.ENTER)

        rows = element.all(By.css(".sentence"))
        expect(rows.count()).toEqual 1



describe "parts navigation", () ->
    prevPart = () -> element(By.css(".pager_ctrls a.prev_part"))
    nextPart = () -> element(By.css(".pager_ctrls a.next_part"))
    currentPartName = () -> element(By.css(".current_part .navtitle"))

    it "should handle parts with parent parts", () ->
        get "/forfattare/RydbergV/titlar/Singoalla1885/sida/25/faksimil"
        expect(prevPart().getAttribute('href')).toBe("http://#{HOST}:9001/forfattare/RydbergV/titlar/Singoalla1885/sida/20/faksimil")
    
    it "should handle many parts on same page, prev", () ->
        get "/forfattare/Anonym/titlar/ABC1746/sida/X/faksimil"
        expect(prevPart().getAttribute('href')).toBe("http://#{HOST}:9001/forfattare/Anonym/titlar/ABC1746/sida/IX/faksimil")

    it "should handle many parts on same page, next", () ->
        get "/forfattare/Anonym/titlar/ABC1746/sida/IX/faksimil"
        expect(nextPart().getAttribute('href')).toBe("http://#{HOST}:9001/forfattare/Anonym/titlar/ABC1746/sida/X/faksimil")

    it "should give a prev part despite prev page being between parts", () ->
        get "/forfattare/BremerF/titlar/NyaTeckningar5/sida/II/faksimil"
        expect(prevPart().getAttribute('href')).toBe("http://#{HOST}:9001/forfattare/BremerF/titlar/NyaTeckningar5/sida/244/faksimil")
    
    it "should find a single page part on the prev page", () ->
        get "/forfattare/BellmanCM/titlar/BellmanStandardupplagan1/sida/CLXXIII/faksimil"
        expect(prevPart().getAttribute('href')).toBe("http://#{HOST}:9001/forfattare/BellmanCM/titlar/BellmanStandardupplagan1/sida/CLXXII/faksimil")

    it "should show current part name instead of ended part", () ->
        get "/forfattare/Euripides/titlar/Elektra1843/sida/9/faksimil"
        expect(currentPartName().getText()).toBe("[Pjäsen]")

    it "should go to beginning of current part rather than previous part", () ->
        get "/forfattare/SvenskaAkademien/titlar/SvenskaAkademiens4/sida/325/faksimil"
        expect(prevPart().getAttribute('href')).toBe("http://#{HOST}:9001/forfattare/SvenskaAkademien/titlar/SvenskaAkademiens4/sida/311/faksimil")

    it "should disable prev if before first part", () ->
        get "/forfattare/OmarKhayyam/titlar/UmrKhaiyamRubaIyat/sida/1/faksimil"
        expect(prevPart().getAttribute('class')).toBe('prev_part disabled')



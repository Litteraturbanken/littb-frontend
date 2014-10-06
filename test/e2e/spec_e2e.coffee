
describe "authors", () ->
    rows = null
    beforeEach () ->
        browser.get "http://localhost:9000/#!/forfattare"
        rows = element.all(By.repeater("row in rowByLetter[selectedLetter] || rows | filter:authorFilter"))

    it "should filter using the input", () ->
        element(By.model("authorFilter")).sendKeys "adel"
        rows.then () ->
            expect(rows.count()).toEqual 1


describe "works", () ->
    rows = null
    testFilter = () ->
    beforeEach () ->
        browser.get "http://localhost:9000/#!/titlar"
        rows = element.all(By.repeater("row in getSource() | orderBy:sorttuple[0]:sorttuple[1] | filter:{mediatype : mediatypeFilter || ''} | filter:filterTitle | filter:filterAuthor"))


    it "should filter works using the input", () ->
        filter = element(By.model("filter"))
        filter.sendKeys("constru")
        filter.sendKeys(protractor.Key.ENTER)
        rows.then () ->
            expect(rows.count()).toEqual 1

describe "titles", () ->
    rows = null
    testFilter = () ->
    beforeEach () ->
        browser.get "http://localhost:9000/#!/titlar?niva=titles"
        rows = element.all(By.repeater("row in getSource() | orderBy:sorttuple[0]:sorttuple[1] | filter:{mediatype : mediatypeFilter || ''} | filter:filterTitle | filter:filterAuthor"))


    it "should filter titles using the input", () ->
        filter = element(By.model("filter"))
        filter.sendKeys("psalm")
        filter.sendKeys(protractor.Key.ENTER)
        rows.then () ->
            expect(rows.count()).toEqual 779


describe "epubList", () ->
    rows = null
    beforeEach () ->
        browser.get "http://localhost:9000/#!/epub"
        rows = element.all(By.repeater("row in rows | filter:rowFilter | orderBy:sorttuple[0]:sorttuple[1]"))


    it "should filter using the input", () ->
        filter = element(By.model("filterTxt"))
        filter.sendKeys("nordanf")
        rows.then () ->
            expect(rows.count()).toEqual 1



describe "reader", () ->
    ptor = null
    beforeEach () ->
        ptor = protractor.getInstance()

    it "should change page on click", () ->
        browser.get "http://localhost:9000/#!/forfattare/StrindbergA/titlar/Fadren/sida/3/etext"
        element(By.css ".pager_ctrls a[rel=next]").click()
        expect(ptor.getCurrentUrl()).toBe("http://localhost:9000/#!/forfattare/StrindbergA/titlar/Fadren/sida/4/etext")
    
    it "should correctly handle pagestep", () ->
        browser.get "http://localhost:9000/#!/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil"
        element(By.css ".pager_ctrls a[rel=next]").click()

        expect(ptor.getCurrentUrl()).toBe("http://localhost:9000/#!/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil")

describe "editor", () ->
    ptor = null
    beforeEach () ->
        ptor = protractor.getInstance()

    it "should change page on click", () ->
        browser.get "http://localhost:9000/#!/editor/lb238704/ix/3/f"
        element(By.css ".pager_ctrls a[rel=next]").click()
        expect(ptor.getCurrentUrl()).toBe("http://localhost:9000/#!/editor/lb238704/ix/4/f")

        expect(element(By.css "img.faksimil").getAttribute("src"))
            .toEqual("http://litteraturbanken.se/txt/lb238704/lb238704_3/lb238704_3_0005.jpeg")


    
    # it "should correctly handle pagestep", () ->
    #     browser.get "http://localhost:9000/#!/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil"
    #     element(By.css ".pager_ctrls a[rel=next]").click()

    #     expect(ptor.getCurrentUrl()).toBe("http://localhost:9000/#!/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil")






describe "search", () ->
    ptor = null
    beforeEach () ->
        ptor = protractor.getInstance()

        browser.get "http://localhost:9000/#!/sok"
        

    it "should give search results. ", () ->

        # element(By.css ".open_toggle").click()
        # won't work :(
        # ptor.findElement((By.cssContainingText "#author_select option", "StrindbergA")).then (elem) ->
        #     elem.click()


        
        input = element(By.model "query")
        input.sendKeys("kriget är förklarat!")
        input.sendKeys(protractor.Key.ENTER)

        rows = element.all(By.repeater("sent in kwic"))
        rows.then () ->
            expect(rows.count()).toEqual 1

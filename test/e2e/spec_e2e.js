const HOST = process.env.LITTB_DOCKER_HOST || "localhost"
const get = url => browser.get(`http://${HOST}:9000` + url)
describe("library authors", function() {
    let rows = null
    beforeEach(function() {
        get("/bibliotek")
    })

    it("should filter using the input", function() {
        const filter = element(By.model("filter"))
        filter.sendKeys("adelb")
        filter.sendKeys(protractor.Key.ENTER)
        rows = element.all(By.repeater("author in getAuthorData()"))
        expect(rows.count()).toEqual(3)
    })
})

describe("library works", function() {
    let rows = null
    beforeEach(function() {
        get("/bibliotek")
        rows = element.all(By.repeater("row in listVisibleTitles()"))
    })

    it("should filter works using the input", function() {
        const filter = element(By.model("filter"))
        filter.sendKeys("constru")
        filter.sendKeys(protractor.Key.ENTER)
        expect(rows.count()).toEqual(1)
    })

    it("should link correctly to reading mode from popular", () => {
        expect(element(By.css("li.link.first li:first-of-type a")).getAttribute("href")).toEqual(
            `http://${HOST}:9000/forfattare/MartinsonH/titlar/Aniara/sida/5/etext`
        )
    })

    it("should link correctly to reading mode from filtered", () => {
        const filter = element(By.model("filter"))
        filter.sendKeys("aniara")
        filter.sendKeys(protractor.Key.ENTER)
        expect(element(By.css("li.link.first li:first-of-type a")).getAttribute("href")).toEqual(
            `http://${HOST}:9000/forfattare/MartinsonH/titlar/Aniara/sida/5/etext`
        )
    })
})

describe("titles", function() {
    let rows = null
    beforeEach(function() {
        get("/bibliotek")
    })

    it("should filter titles using the input", function() {
        const filter = element(By.model("filter"))
        filter.sendKeys("psalm")
        filter.sendKeys(protractor.Key.ENTER)
        let num = element(By.css(".show_all .num"))
        expect(num.getText()).toEqual("812")
    })
})

describe("epubList", function() {
    let rows = null
    beforeEach(function() {
        get("/epub")
    })

    it("should filter using the input", function() {
        const filter = element(By.model("filterTxt"))
        filter.sendKeys("nordanf")
        // rows = element.all(By.repeater("row in rows | filter:rowFilter | orderBy:sorttuple[0]:sorttuple[1]"))
        let rows = element.all(By.css(".tablerow"))
        expect(rows.count()).toEqual(1)
    })
})

describe("reader", function() {
    // beforeEach () ->

    it("should change page on click", function() {
        get("/forfattare/StrindbergA/titlar/Fadren/sida/3/etext")
        element(By.css(".pager_ctrls a[rel=next]"))
            .getAttribute("href")
            .then(linkUrl =>
                expect(linkUrl).toBe(
                    `http://${HOST}:9000/forfattare/StrindbergA/titlar/Fadren/sida/4/etext`
                )
            )
    })

    it("should correctly handle pagestep", function() {
        get("/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil")

        element(By.css(".pager_ctrls a[rel=next]"))
            .getAttribute("href")
            .then(function(linkUrl) {
                browser.get(linkUrl)
                expect(browser.getCurrentUrl()).toBe(
                    `http://${HOST}:9000/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil`
                )
            })
    })

    it("should load workinfo from the correct mediatype", function() {
        get("/forfattare/LagerlofS/titlar/Dunungen/sida/1/etext")

        expect(element(By.css(".pager_ctrls a[rel=next]")).getAttribute("href")).toBe(
            `http://${HOST}:9000/forfattare/LagerlofS/titlar/Dunungen/sida/2/etext`
        )
    })
})

describe("editor", function() {
    // beforeEach () ->

    it("should change page on click", function() {
        get("/editor/lb238704/ix/3/f")

        return element(By.css(".pager_ctrls a[rel=next]"))
            .getAttribute("href")
            .then(function() {
                element(By.css(".pager_ctrls a[rel=next]")).click()
                expect(browser.getCurrentUrl()).toBe(`http://${HOST}:9000/editor/lb238704/ix/4/f`)

                expect(element(By.css("img.faksimil")).getAttribute("src")).toEqual(
                    `http://${HOST}:9000/txt/lb238704/lb238704_3/lb238704_3_0005.jpeg`
                )
            })
    })

    it("should correctly handle pagestep", function() {
        get("/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil")
        return element(By.css(".pager_ctrls a[rel=next]"))
            .getAttribute("href")
            .then(function(linkUrl) {
                browser.get(linkUrl)
                expect(browser.getCurrentUrl()).toBe(
                    `http://${HOST}:9000/forfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil`
                )
            })
    })
})

describe("search", function() {
    beforeEach(() => get("/sök"))

    it("should give search results. ", function() {
        const input = element(By.model("query"))
        input.sendKeys("kriget är förklarat !")
        input.sendKeys(protractor.Key.ENTER)

        const rows = element.all(By.css(".sentence"))
        expect(rows.count()).toEqual(1)
    })
})

describe("parts navigation", function() {
    const prevPart = () => element(By.css(".pager_ctrls a.prev_part"))
    const nextPart = () => element(By.css(".pager_ctrls a.next_part"))
    const currentPartName = () => element(By.css(".current_part .navtitle"))

    it("should handle parts with parent parts", function() {
        get("/forfattare/RydbergV/titlar/Singoalla1885/sida/25/faksimil")
        expect(prevPart().getAttribute("href")).toBe(
            `http://${HOST}:9000/forfattare/RydbergV/titlar/Singoalla1885/sida/20/faksimil`
        )
    })

    it("should handle many parts on same page, prev", function() {
        get("/forfattare/Anonym/titlar/ABC1746/sida/X/faksimil")
        expect(prevPart().getAttribute("href")).toBe(
            `http://${HOST}:9000/forfattare/Anonym/titlar/ABC1746/sida/IX/faksimil`
        )
    })

    it("should handle many parts on same page, next", function() {
        get("/forfattare/Anonym/titlar/ABC1746/sida/IX/faksimil")
        expect(nextPart().getAttribute("href")).toBe(
            `http://${HOST}:9000/forfattare/Anonym/titlar/ABC1746/sida/X/faksimil`
        )
    })

    it("should give a prev part despite prev page being between parts", function() {
        get("/forfattare/BremerF/titlar/NyaTeckningar5/sida/II/faksimil")
        expect(prevPart().getAttribute("href")).toBe(
            `http://${HOST}:9000/forfattare/BremerF/titlar/NyaTeckningar5/sida/244/faksimil`
        )
    })

    it("should find a single page part on the prev page", function() {
        get("/forfattare/BellmanCM/titlar/BellmanStandardupplagan1/sida/CLXXIII/faksimil")
        expect(prevPart().getAttribute("href")).toBe(
            `http://${HOST}:9000/forfattare/BellmanCM/titlar/BellmanStandardupplagan1/sida/CLXXII/faksimil`
        )
    })

    it("should show current part name instead of ended part", function() {
        get("/forfattare/Euripides/titlar/Elektra1843/sida/9/faksimil")
        expect(currentPartName().getText()).toBe("[Pjäsen]")
    })

    it("should go to beginning of current part rather than previous part", function() {
        get("/forfattare/SvenskaAkademien/titlar/SvenskaAkademiens4/sida/325/faksimil")
        expect(prevPart().getAttribute("href")).toBe(
            `http://${HOST}:9000/forfattare/SvenskaAkademien/titlar/SvenskaAkademiens4/sida/311/faksimil`
        )
    })

    it("should disable prev if before first part", function() {
        get("/forfattare/OmarKhayyam/titlar/UmrKhaiyamRubaIyat/sida/1/faksimil")
        expect(prevPart().getAttribute("class")).toBe("prev_part disabled")
    })
})

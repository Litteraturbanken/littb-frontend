let { browser } = require("protractor")

const HOST = process.env.LITTB_DOCKER_HOST || "localhost"
const get = url => browser.get(`http://${HOST}:9000` + url)
describe("library authors", function () {
    beforeEach(function () {
        get("/bibliotek?sort=popularitet&visa=authors")
    })

    it("should filter using the input", function () {
        const filter = element(By.model("filter"))
        filter.sendKeys("adelb")
        filter.sendKeys(protractor.Key.TAB)
        expect(element.all(By.css(".author_row")).count()).toEqual(1)
    })
})

describe("library works", function () {
    beforeEach(function () {
        get("/bibliotek?visa=works")
    })

    it("should filter works using the input", function () {
        const filter = element(By.model("filter"))
        filter.sendKeys("constru")
        filter.sendKeys(protractor.Key.TAB)
        // browser.wait(() => rows.count() == 1)

        expect(element.all(By.css(".work_link")).count()).toEqual(1)
    })

    it("should link correctly to reading mode from popular", () => {
        expect(
            element(By.css("tr.work_link.first li:first-of-type a")).getAttribute("href")
        ).toEqual(`/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext`)
    })

    it("should link correctly to reading mode from filtered", () => {
        const filter = element(By.model("filter"))
        filter.sendKeys("aniara")
        // filter.sendKeys(protractor.Key.ENTER)
        expect(
            element(By.css("tr.work_link.first li:first-of-type a")).getAttribute("href")
        ).toEqual(`/författare/MartinsonH/titlar/Aniara/sida/5/etext`)
    })
})

describe("library relevance", function () {
    let filter
    let getMostRelTitle = () =>
        element.all(By.css(".result.relevance tr[ng-repeat] a")).first().getText()

    beforeEach(function () {
        get("/bibliotek")
        filter = element(By.model("filter"))
    })

    it("should contain various external sources in default list", () => {
        let elems = element.all(By.css(".result.relevance tr[ng-repeat] td:first-child span"))
        expect(elems.getText()).toContain("ljud och bild")
        expect(elems.getText()).toContain("diktens museum")
        expect(elems.getText()).toContain("kringtexter")
        expect(elems.getText()).toContain("skolan")
    })

    it("should give more popular first", () => {
        filter.sendKeys("glas")
        expect(getMostRelTitle()).toEqual("Doktor Glas")
    })

    it("should score surname hits above popularity", () => {
        filter.sendKeys("öman poetisk")
        expect(getMostRelTitle()).toEqual("Poetisk läsebok för folkskolan")
    })
})

describe("titles", function () {
    let rows = null
    beforeEach(function () {
        get("/bibliotek")
    })

    it("should filter titles using the input", function () {
        const filter = element(By.model("filter"))
        filter.sendKeys("psalm")
        filter.sendKeys(protractor.Key.ENTER)
        let num = element(By.css(".parts.num_hits"))
        expect(num.getText()).toEqual(": 825")
    })
})

describe("epubList", function () {
    let rows = null
    beforeEach(function () {
        get("/epub")
    })

    it("should filter using the input", function () {
        const filter = element(By.model("filterTxt"))
        filter.sendKeys("nordanf")
        // rows = element.all(By.repeater("row in rows | filter:rowFilter | orderBy:sorttuple[0]:sorttuple[1]"))
        let rows = element.all(By.css(".tablerow"))
        expect(rows.count()).toEqual(2)
    })
})

describe("reader", function () {
    // beforeEach () ->

    it("should change page on click", function () {
        get("/författare/StrindbergA/titlar/Fadren/sida/3/etext")
        element(By.css(".pager_ctrls a[rel=next]"))
            .getAttribute("href")
            .then(linkUrl =>
                expect(linkUrl).toBe(`/författare/StrindbergA/titlar/Fadren/sida/4/etext`)
            )
    })

    it("should correctly handle pagestep", function () {
        get("/författare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil")

        element(By.css(".pager_ctrls a[rel=next]"))
            .getAttribute("href")
            .then(function (linkUrl) {
                get(linkUrl)
                expect(browser.getCurrentUrl()).toBe(
                    `http://${HOST}:9000/f%C3%B6rfattare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil'`
                )
            })
    })

    it("should load workinfo from the correct mediatype", function () {
        get("/författare/LagerlofS/titlar/Dunungen/sida/1/etext")

        expect(element(By.css(".pager_ctrls a[rel=next]")).getAttribute("href")).toBe(
            `/författare/LagerlofS/titlar/Dunungen/sida/2/etext`
        )
    })

    it("should show SO modal", function () {
        get("/författare/SöderbergH/titlar/DoktorGlas/sida/1/etext?so=damm")
        expect(
            element(By.css(".modal-dialog lemma[id=lnr132506] grundform")).getText("href")
        ).toEqual("damm")
    })

    it("should show srcset correctly", function () {
        get("/författare/BureusJ/titlar/SmaragdinaTabvla/sida/1/faksimil")
        expect(element(By.css("img.faksimil")).getAttribute("srcset")).toEqual(
            "/txt/lb2514233/lb2514233_3/lb2514233_3_0001.jpeg 1x,/txt/lb2514233/lb2514233_5/lb2514233_5_0001.jpeg 2x"
        )
    })
    it("should not show srcset", function () {
        get("/författare/BellmanCM/titlar/FredmansEpistlesSongs/sida/V/faksimil")
        expect(element(By.css("img.faksimil")).getAttribute("srcset")).toEqual(null)
    })
})

describe("editor", function () {
    // beforeEach () ->

    it("should change page on click", function () {
        get("/editor/lb238704/ix/3/f")

        element(By.css(".pager_ctrls a[rel=next]"))
            .getAttribute("href")
            .then(function () {
                element(By.css(".pager_ctrls a[rel=next]")).click()
                expect(browser.getCurrentUrl()).toBe(`http://localhost:9000/editor/lb238704/ix/4/f`)

                expect(element(By.css("img.faksimil")).getAttribute("src")).toEqual(
                    `/txt/lb238704/lb238704_3/lb238704_3_0005.jpeg`
                )
            })
    })
})
describe("search links", function () {
    beforeEach(() => get("/sök?forfattare=MartinsonH&titlar=lb441882&avancerad"))

    it("should preselect author and title", function () {
        let main = element(by.id("mainview"))
        main.evaluate("selectedTitles").then(val => {
            expect(val.length).toBe(1)
            expect(val[0]).toEqual("lb441882")
        })

        main.evaluate("filters['authors>authorid'][0]").then(val => {
            expect(val).toEqual("MartinsonH")
        })
    })
})

describe("search", function () {
    beforeEach(() => get("/sök"))

    it("should give search results. ", function () {
        const input = element(By.model("query"))
        input.sendKeys("kriget är förklarat!")
        input.sendKeys(protractor.Key.ENTER)

        const rows = element.all(By.css(".sentence"))
        expect(rows.count()).toEqual(1)
    })
})

describe("parts navigation", function () {
    const prevPart = () => element(By.css(".pager_ctrls a.prev_part"))
    const nextPart = () => element(By.css(".pager_ctrls a.next_part"))
    const currentPartName = () => element(By.css(".current_part .navtitle"))

    it("should handle parts with parent parts", function () {
        get("/författare/RydbergV/titlar/Singoalla1885/sida/25/faksimil")
        expect(prevPart().getAttribute("href")).toBe(
            `/författare/RydbergV/titlar/Singoalla1885/sida/20/faksimil`
        )
    })

    it("should handle many parts on same page, prev", function () {
        get("/författare/Anonym/titlar/ABC1746/sida/X/faksimil")
        expect(prevPart().getAttribute("href")).toBe(
            `/författare/Anonym/titlar/ABC1746/sida/IX/faksimil`
        )
    })

    it("should handle many parts on same page, next", function () {
        get("/författare/Anonym/titlar/ABC1746/sida/IX/faksimil")
        expect(nextPart().getAttribute("href")).toBe(
            `/författare/Anonym/titlar/ABC1746/sida/X/faksimil`
        )
    })

    it("should give a prev part despite prev page being between parts", function () {
        get("/författare/BremerF/titlar/NyaTeckningar5/sida/II/faksimil")
        expect(prevPart().getAttribute("href")).toBe(
            `/författare/BremerF/titlar/NyaTeckningar5/sida/244/faksimil`
        )
    })

    it("should find a single page part on the prev page", function () {
        get("/författare/BellmanCM/titlar/BellmanStandardupplagan1/sida/CLXXIII/faksimil")
        expect(prevPart().getAttribute("href")).toBe(
            `/författare/BellmanCM/titlar/BellmanStandardupplagan1/sida/CLXXII/faksimil`
        )
    })

    it("should show current part name instead of ended part", function () {
        get("/författare/Euripides/titlar/Elektra1843/sida/9/faksimil")
        expect(currentPartName().getText()).toBe("[Pjäsen]")
    })

    it("should go to beginning of current part rather than previous part", function () {
        get("/författare/SvenskaAkademien/titlar/SvenskaAkademiens4/sida/325/faksimil")
        expect(prevPart().getAttribute("href")).toBe(
            `/författare/SvenskaAkademien/titlar/SvenskaAkademiens4/sida/311/faksimil`
        )
    })

    it("should disable prev if before first part", function () {
        get("/författare/OmarKhayyam/titlar/UmrKhaiyamRubaIyat/sida/1/faksimil")
        expect(prevPart().getAttribute("class")).toBe("prev_part disabled")
    })
})

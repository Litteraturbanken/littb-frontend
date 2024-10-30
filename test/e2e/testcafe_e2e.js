import { Selector, ClientFunction } from "testcafe"

const HOST = process.env.LITTB_DOCKER_HOST || "localhost"
const get = url => `http://${HOST}:9000${url}`

const waitForAngular = ClientFunction(() => {
    return new Promise(resolve => {
        const check = () => {
            if (window.getAllAngularTestabilities) {
                const testabilities = window.getAllAngularTestabilities()
                if (testabilities.every(testability => testability.isStable())) {
                    resolve()
                } else {
                    setTimeout(check, 50)
                }
            } else {
                resolve()
            }
        }
        check()
    })
})

fixture`Library Authors`
    .page(get("/bibliotek?sort=popularitet&visa=authors"))
    .beforeEach(async t => {
        await waitForAngular()
    })

test("should filter using the input", async t => {
    const filter = Selector('[ng-model="filter"]')
    await t.typeText(filter, "adelb").pressKey("tab").expect(Selector(".author_row").count).eql(1)
})

fixture`Library Works`.page(get("/bibliotek?visa=works")).beforeEach(async t => {
    await waitForAngular()
})

test("should filter works using the input", async t => {
    const filter = Selector('[ng-model="filter"]')
    await t.typeText(filter, "constru").pressKey("tab").expect(Selector(".work_link").count).eql(1)
})

test("should link correctly to reading mode from popular", async t => {
    await t
        .expect(Selector("tr.work_link.first li:first-of-type a").getAttribute("href"))
        .eql(`/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext`)
})

test("should link correctly to reading mode from filtered", async t => {
    const filter = Selector('[ng-model="filter"]')
    await t
        .typeText(filter, "aniara")
        .expect(Selector("tr.work_link.first li:first-of-type a").getAttribute("href"))
        .eql(`/författare/MartinsonH/titlar/Aniara/sida/5/etext`)
})

fixture`Library Relevance`.page(get("/bibliotek")).beforeEach(async t => {
    await waitForAngular()
})

// test("should contain various external sources in default list", async t => {
//     const elems = Selector(".result.relevance tr[ng-repeat] td:first-child span")
//     const expectedTexts = ["ljud och bild", "diktens museum", "kringtexter", "skolan"]

//     for (const text of expectedTexts) {
//         await t.expect(elems.withText(text).exists).ok()
//     }
// })

test("should give more popular first", async t => {
    const filter = Selector('[ng-model="filter"]')
    await t
        .typeText(filter, "glas")
        .expect(Selector(".result.relevance tr[ng-repeat] a").nth(0).innerText)
        .eql("Doktor Glas")
})

test("should score surname hits above popularity", async t => {
    const filter = Selector('[ng-model="filter"]')
    await t
        .typeText(filter, "öman poetisk")
        .expect(Selector(".result.relevance tr[ng-repeat] a").nth(0).innerText)
        .eql("Poetisk läsebok för folkskolan")
})

fixture`Titles`.page(get("/bibliotek")).beforeEach(async t => {
    await waitForAngular()
})

test("should filter titles using the input", async t => {
    const filter = Selector('[ng-model="filter"]')
    await t
        .typeText(filter, "psalm")
        .pressKey("enter")
        .expect(Selector(".parts.num_hits").innerText)
        .eql(": 878")
})

fixture`Reader`.beforeEach(async t => {
    await waitForAngular()
})

test("should change page on click", async t => {
    await t
        .navigateTo(get("/författare/StrindbergA/titlar/Fadren/sida/3/etext"))
        .expect(Selector(".pager_ctrls a[rel=next]").getAttribute("href"))
        .eql(`/författare/StrindbergA/titlar/Fadren/sida/4/etext`)
})

test("should correctly handle pagestep", async t => {
    await t
        .navigateTo(get("/författare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-7/faksimil"))
        .expect(Selector(".pager_ctrls a[rel=next]").getAttribute("href"))
        .eql(`/författare/SilfverstolpeM/titlar/ManneDetGarAn/sida/-5/faksimil`)
})

test("should load workinfo from the correct mediatype", async t => {
    await t
        .navigateTo(get("/författare/LagerlofS/titlar/Dunungen/sida/1/etext"))
        .expect(Selector(".pager_ctrls a[rel=next]").getAttribute("href"))
        .eql(`/författare/LagerlofS/titlar/Dunungen/sida/2/etext`)
})

test("should show SO modal", async t => {
    await t
        .navigateTo(get("/författare/SöderbergH/titlar/DoktorGlas/sida/1/etext?so=damm"))
        // .wait(500)
        .expect(Selector(".modal-dialog lemma[id=lnr132506] grundform").innerText)
        .eql("damm")
})

test("should show srcset correctly", async t => {
    await t
        .navigateTo(get("/författare/BureusJ/titlar/SmaragdinaTabvla/sida/1/faksimil"))
        .expect(Selector("img.faksimil").getAttribute("srcset"))
        .eql(
            `/txt/lb2514233/lb2514233_3/lb2514233_3_0001.jpeg 1x,/txt/lb2514233/lb2514233_5/lb2514233_5_0001.jpeg 2x`
        )
})

test("should not show srcset", async t => {
    await t
        .navigateTo(get("/författare/BellmanCM/titlar/FredmansEpistlesSongs/sida/V/faksimil"))
        .expect(Selector("img.faksimil").getAttribute("srcset"))
        .eql(null)
})

fixture`Editor`.beforeEach(async t => {
    await waitForAngular()
})

test("should change page on click", async t => {
    await t
        .navigateTo(get("/editor/lb238704/ix/3/f"))
        .click(Selector(".pager_ctrls a[rel=next]"))
        .expect(Selector("img.faksimil").getAttribute("src"))
        .eql(`/txt/lb238704/lb238704_3/lb238704_3_0005.jpeg`)
})

fixture`Search Links`
    .page(get("/sök?forfattare=MartinsonH&titlar=lb441882&avancerad"))
    .beforeEach(async t => {
        await waitForAngular()
    })

test("should preselect author and title", async t => {
    const main = Selector("#mainview")
    const selectedTitles = await t.eval(() => $("#mainview").scope().selectedTitles)
    const filters = await t.eval(() => $("#mainview").scope().filters)

    await t
        .expect(selectedTitles.length)
        .eql(1)
        .expect(selectedTitles[0])
        .eql("lb441882")
        .expect(filters["authors>authorid"][0])
        .eql("MartinsonH")
})

fixture`Search`.page(get("/sök")).beforeEach(async t => {
    await waitForAngular()
})

test("should give search results", async t => {
    const input = Selector('[ng-model="query"]')
    await t
        .typeText(input, "kriget är förklarat!")
        .pressKey("enter")
        .expect(Selector(".sentence").count)
        .eql(3)
})

fixture`Parts Navigation`.beforeEach(async t => {
    await waitForAngular()
})

test("should handle parts with parent parts", async t => {
    await t
        .navigateTo(get("/författare/RydbergV/titlar/Singoalla1885/sida/25/faksimil"))
        .expect(Selector(".pager_ctrls a.prev_part").getAttribute("href"))
        .eql(`/författare/RydbergV/titlar/Singoalla1885/sida/20/faksimil`)
})

test("should handle many parts on same page, prev", async t => {
    await t
        .navigateTo(get("/författare/Anonym/titlar/ABC1746/sida/X/faksimil"))
        .expect(Selector(".pager_ctrls a.prev_part").getAttribute("href"))
        .eql(`/författare/Anonym/titlar/ABC1746/sida/IX/faksimil`)
})

test("should handle many parts on same page, next", async t => {
    await t
        .navigateTo(get("/författare/Anonym/titlar/ABC1746/sida/IX/faksimil"))
        .expect(Selector(".pager_ctrls a.next_part").getAttribute("href"))
        .eql(`/författare/Anonym/titlar/ABC1746/sida/X/faksimil`)
})

test("should give a prev part despite prev page being between parts", async t => {
    await t
        .navigateTo(get("/författare/BremerF/titlar/NyaTeckningar5/sida/II/faksimil"))
        .expect(Selector(".pager_ctrls a.prev_part").getAttribute("href"))
        .eql(`/författare/BremerF/titlar/NyaTeckningar5/sida/244/faksimil`)
})

test("should find a single page part on the prev page", async t => {
    await t
        .navigateTo(
            get("/författare/BellmanCM/titlar/BellmanStandardupplagan1/sida/CLXXIII/faksimil")
        )
        .expect(Selector(".pager_ctrls a.prev_part").getAttribute("href"))
        .eql(`/författare/BellmanCM/titlar/BellmanStandardupplagan1/sida/CLXXII/faksimil`)
})

test("should show current part name instead of ended part", async t => {
    await t
        .navigateTo(get("/författare/Euripides/titlar/Elektra1843/sida/9/faksimil"))
        .expect(Selector(".current_part .navtitle").innerText)
        .eql("[Pjäsen]")
})

test("should go to beginning of current part rather than previous part", async t => {
    await t
        .navigateTo(get("/författare/SvenskaAkademien/titlar/SvenskaAkademiens4/sida/325/faksimil"))
        .expect(Selector(".pager_ctrls a.prev_part").getAttribute("href"))
        .eql(`/författare/SvenskaAkademien/titlar/SvenskaAkademiens4/sida/311/faksimil`)
})

test("should disable prev if before first part", async t => {
    await t
        .navigateTo(get("/författare/OmarKhayyam/titlar/UmrKhaiyamRubaIyat/sida/1/faksimil"))
        .expect(Selector(".pager_ctrls a.prev_part").hasClass("disabled"))
        .ok()
})

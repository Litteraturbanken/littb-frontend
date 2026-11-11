import assert from "node:assert/strict"
import { legacySourceInfoUrl } from "../../app/scripts/legacySourceInfoUrl.mjs"

const params = { authorid: "LitheniusS", titlepath: "FritzOchHildasJulafton" }
assert.equal(
    legacySourceInfoUrl(params, { mediatype: "infopost" }),
    "/dramawebben/pjäser?om-boken&authorid=LitheniusS&titlepath=FritzOchHildasJulafton#dw"
)
// Query parameters must keep their identity when they contain URL delimiters.
const encoded = new URL(legacySourceInfoUrl(
    { authorid: "Å&Co", titlepath: "En titel?#&" },
    { mediatype: "infopost" }
), "https://litteraturbanken.se")
assert.equal(encoded.searchParams.get("authorid"), "Å&Co")
assert.equal(encoded.searchParams.get("titlepath"), "En titel?#&")
assert.equal(encoded.hash, "#dw")
for (const mediatype of ["etext", "faksimil"]) {
    assert.equal(
        legacySourceInfoUrl(params, { mediatype, startpagename: "I" }),
        `/författare/LitheniusS/titlar/FritzOchHildasJulafton/sida/I/${mediatype}?om-boken`
    )
}
console.log("Legacy source-info URL tests passed")

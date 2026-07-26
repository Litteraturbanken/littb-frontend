// @ts-check

/** @typedef {import("../../app/lib/api/generated/lbapi").components["schemas"]["BibliographyEntry"]} BibliographyEntry */

/** @type {ReadonlyArray<BibliographyEntry>} */
export const bibliographyEntries = Object.freeze([
  {
    title: "Gösta Berlings saga",
    isbn: "978-00-1",
    issn: "",
    archive: "SE/ULA/123"
  },
  {
    title: "En herrgårdssägen",
    isbn: null,
    issn: "1400-0001",
    archive: null
  },
  {
    title: "Jerusalem i forskningen",
    isbn: "978-00-3",
    issn: null,
    archive: "SE/KB/456"
  }
])

// This is the fixed Angular backend payload. The keys and order match the
// typed Nuxt fixture above after Angular's XML parser maps each <entry>.
export const angularBibliographyXml = `<?xml version="1.0" encoding="UTF-8"?>
<entries>
  <entry><title>Gösta Berlings saga</title><isbn>978-00-1</isbn><issn></issn><manusarchive><ArchiveID>SE/ULA/123</ArchiveID></manusarchive></entry>
  <entry><title>En herrgårdssägen</title><isbn></isbn><issn>1400-0001</issn><manusarchive><ArchiveID></ArchiveID></manusarchive></entry>
  <entry><title>Jerusalem i forskningen</title><isbn>978-00-3</isbn><issn></issn><manusarchive><ArchiveID>SE/KB/456</ArchiveID></manusarchive></entry>
</entries>`

function paddedUtf8Fixture(prefix, suffix, targetBytes) {
  const prefixBytes = Buffer.from(prefix)
  const suffixBytes = Buffer.from(suffix)
  const paddingBytes = targetBytes - prefixBytes.byteLength - suffixBytes.byteLength
  if (paddingBytes < 0) throw new RangeError("Presentation boundary fixture exceeds target")
  return Buffer.concat([prefixBytes, Buffer.alloc(paddingBytes, 0x20), suffixBytes])
}

export const productionSizedPresentationDocument = paddedUtf8Fixture(
  [
    "<!DOCTYPE html>",
    '<html xmlns="http://www.w3.org/1999/xhtml">',
    "<head>",
    "<title>Production-sized Presentation</title>",
    "</head>",
    "<body>",
    '<main class="production-sized-presentation">',
    "<h1>Production-sized Presentation</h1>",
    '<p id="production-sized-document-marker">The complete article remains rendered.</p>',
    '<div class="measured-corpus-padding">'
  ].join(""),
  "</div></main></body></html>",
  75_220
)

export const productionSizedPresentationBackground = paddedUtf8Fixture(
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<backgrounds>",
    '<background target="/presentationer/specialomraden/ProductionSized.html" ',
    'url="/red/bilder/bakgrundsbilder/rostratt_a.jpg" ',
    'class="production-sized measured">',
    "<style>html { background-color: #123456; }</style>",
    "</background>",
    "<!--"
  ].join(""),
  "--></backgrounds>",
  4_741
)

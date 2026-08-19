import { proxyReaderSourceRequest } from "../../utils/reader-source-proxy"

export default defineEventHandler(event => proxyReaderSourceRequest(event, "/bilder"))

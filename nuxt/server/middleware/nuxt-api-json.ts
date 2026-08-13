import { defineEventHandler } from "h3"

const nuxtApiPrefix = "/nuxt-api/"

export default defineEventHandler(event => {
  if (event.path === "/nuxt-api" || event.path.startsWith(nuxtApiPrefix)) {
    event.node.req.headers.accept = "application/json"
  }
})

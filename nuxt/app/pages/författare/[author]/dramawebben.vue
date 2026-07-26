<script setup lang="ts">
import AuthorProfileContent from "~/components/author/AuthorProfileContent.vue"
import { createLbApiClient } from "~/lib/api/client"
import {
  authorProfilePath,
  createAuthorProfileView,
  type AuthorProfileView,
  validateAuthorRouteParam
} from "~/lib/author-profile"
import dramawebbenBackground from "~/assets/img/dramawebben_fade_more.jpg"

type ProfileResponse = {
  view: AuthorProfileView | null
  status: number
  canonicalPath: string
  hasDramawebben: boolean
}

definePageMeta({
  validate: route => {
    const author = Array.isArray(route.params.author)
      ? route.params.author[0]
      : route.params.author
    return validateAuthorRouteParam(author)
  }
})

const route = useRoute()
const config = useRuntimeConfig()
const authorId = computed(() => {
  const value = Array.isArray(route.params.author) ? route.params.author[0] : route.params.author
  return typeof value === "string" ? value : ""
})
const asyncKey = computed(() => `author-profile:dramawebben:${authorId.value}`)
const client = createLbApiClient(import.meta.server ? config.apiBase : config.public.apiBase)

const { data } = await useAsyncData<ProfileResponse>(
  asyncKey,
  async () => {
    try {
      const { data: profile, response } = await client.GET("/authors/{author_id}", {
        params: { path: { author_id: authorId.value } }
      })
      const hasDramawebben = Boolean(profile?.dramawebben)
      return {
        view: profile
          ? createAuthorProfileView(profile, hasDramawebben ? "dramawebben" : "ordinary")
          : null,
        status: profile ? 200 : response.status === 404 ? 404 : 503,
        canonicalPath: profile?.canonical_path ?? "",
        hasDramawebben
      }
    } catch {
      return { view: null, status: 503, canonicalPath: "", hasDramawebben: false }
    }
  },
  {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] as ProfileResponse | undefined
  }
)

const response = computed(() => data.value ?? {
  view: null,
  status: 503,
  canonicalPath: "",
  hasDramawebben: false
})

if (import.meta.server && response.value.status !== 200) {
  setResponseStatus(response.value.status === 404 ? 404 : 503)
}

if (response.value.status === 200 && !response.value.hasDramawebben) {
  if (import.meta.client) {
    const nuxtApp = useNuxtApp()
    nuxtApp.payload.data[`author-profile:ordinary:${authorId.value}`] = response.value
  }
  await navigateTo(
    { path: authorProfilePath(authorId.value), query: route.query },
    { redirectCode: 307, replace: true }
  )
}

const view = computed(() => response.value.view)
useAuthorQuickSearchContextPublisher(view)
const description = computed(() => view.value
  ? `${view.value.fullName}, Introduktion av Dramawebben`
  : "Författarprofil")

useSeoMeta({
  title: () => view.value
    ? `${view.value.fullName}, Introduktion av Dramawebben | Litteraturbanken`
    : "Författarprofil | Litteraturbanken",
  description
})
useHead({
  htmlAttrs: { style: `background: url('${dramawebbenBackground}') no-repeat;` },
  bodyAttrs: { class: "focus page-authorInfo ready" }
})
</script>

<template>
  <div>
    <div v-if="response.status === 404" class="error">
      Ett fel har inträffat: författarid <code>{{ authorId }}</code> kan inte hittas. Kontrollera adressen.
    </div>
    <div v-else-if="response.status !== 200" class="error">
      Ett fel har inträffat. Författarprofilen kan inte visas just nu.
    </div>
    <AuthorProfileContent v-else-if="view" :profile="view" variant="dramawebben" />
  </div>
</template>

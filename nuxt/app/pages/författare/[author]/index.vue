<script setup lang="ts">
import AuthorProfileContent from "~/components/author/AuthorProfileContent.vue"
import { createLbApiClient } from "~/lib/api/client"
import {
  authorProfilePath,
  createAuthorProfileView,
  type AuthorProfileView,
  validateAuthorRouteParam
} from "~/lib/author-profile"
import ordinaryBackground from "~/assets/img/forf2_bkg.jpg"

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
const asyncKey = computed(() => `author-profile:ordinary:${authorId.value}`)
const client = createLbApiClient(import.meta.server ? config.apiBase : config.public.apiBase)

function clientAuthorPath(path: string): string {
  return path.replace(/^\/författare(?=\/|$)/u, "/f%C3%B6rfattare")
}

const { data } = await useAsyncData<ProfileResponse>(
  asyncKey,
  async () => {
    try {
      const { data: profile, response } = await client.GET("/authors/{author_id}", {
        params: { path: { author_id: authorId.value } }
      })
      const canonicalPath = profile?.canonical_path ?? ""
      const isDramawebbenCanonical = Boolean(profile?.dramawebben)
        && clientAuthorPath(canonicalPath) === authorProfilePath(authorId.value, "dramawebben")
      return {
        view: profile
          ? createAuthorProfileView(profile, isDramawebbenCanonical ? "dramawebben" : "ordinary")
          : null,
        status: profile ? 200 : response.status === 404 ? 404 : 503,
        canonicalPath,
        hasDramawebben: Boolean(profile?.dramawebben)
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

if (response.value.canonicalPath) {
  const rootPath = authorProfilePath(authorId.value)
  const canonicalPath = clientAuthorPath(response.value.canonicalPath)
  if (canonicalPath !== rootPath) {
    if (
      import.meta.client
      && response.value.hasDramawebben
      && canonicalPath === authorProfilePath(authorId.value, "dramawebben")
    ) {
      const nuxtApp = useNuxtApp()
      nuxtApp.payload.data[`author-profile:dramawebben:${authorId.value}`] = response.value
    }
    await navigateTo(
      { path: canonicalPath, query: route.query },
      { redirectCode: 307, replace: true }
    )
  }
}

const view = computed(() => response.value.view)
const description = computed(() => view.value
  ? `${view.value.fullName}, Introduktion`
  : "Författarprofil")

useSeoMeta({
  title: () => view.value
    ? `${view.value.fullName}, Introduktion | Litteraturbanken`
    : "Författarprofil | Litteraturbanken",
  description
})
useHead({
  htmlAttrs: { style: `background: url('${ordinaryBackground}') no-repeat;` },
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
    <AuthorProfileContent v-else-if="view" :profile="view" variant="ordinary" />
  </div>
</template>

<script setup lang="ts">
import AuthorProfileContent from "~/components/author/AuthorProfileContent.vue"
import type { components } from "~/lib/api/generated/lbapi"
import { createLbApiClient } from "~/lib/api/client"
import {
  createAuthorProfileView,
  validateAuthorRouteParam
} from "~/lib/author-profile"
import ordinaryBackground from "~/assets/img/forf2_bkg.jpg"

type AuthorProfile = components["schemas"]["AuthorProfile"]
type ProfileResponse = { profile: AuthorProfile | null, status: number }

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
const asyncKey = computed(() => `author-profile:${authorId.value}`)
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
      return {
        profile: profile ?? null,
        status: profile ? 200 : response.status === 404 ? 404 : 503
      }
    } catch {
      return { profile: null, status: 503 }
    }
  },
  {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] as ProfileResponse | undefined
  }
)

const response = computed(() => data.value ?? { profile: null, status: 503 })
const profile = computed(() => response.value.profile)

if (import.meta.server && response.value.status !== 200) {
  setResponseStatus(response.value.status === 404 ? 404 : 503)
}

if (profile.value) {
  const rootPath = `/författare/${encodeURIComponent(authorId.value)}`
  if (profile.value.canonical_path !== rootPath) {
    await navigateTo(
      { path: clientAuthorPath(profile.value.canonical_path), query: route.query },
      { redirectCode: 307, replace: true }
    )
  }
}

const view = computed(() => profile.value
  ? createAuthorProfileView(profile.value, "ordinary")
  : null)
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

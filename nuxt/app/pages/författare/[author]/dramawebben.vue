<script setup lang="ts">
import AuthorProfileContent from "~/components/author/AuthorProfileContent.vue"
import { useLbApiClient } from "~/composables/useLbApiClient"
import {
  authorProfilePath,
  createAuthorProfileView,
  type AuthorProfileView,
  validateAuthorRouteParam
} from "~/lib/author-profile"
import dramawebbenBackground from "~/assets/img/dramawebben_fade_more.jpg"

type ProfileResponse = {
  identity: string
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
const authorId = computed(() => {
  const value = Array.isArray(route.params.author) ? route.params.author[0] : route.params.author
  return typeof value === "string" ? value : ""
})
const asyncKey = computed(() => `author-profile:dramawebben:${authorId.value}`)
const currentIdentity = computed(() => `dramawebben:${authorId.value}`)
const pendingIdentity = shallowRef<string | null>(null)
onBeforeRouteUpdate(to => {
  const value = Array.isArray(to.params.author) ? to.params.author[0] : to.params.author
  pendingIdentity.value = `dramawebben:${typeof value === "string" ? value : ""}`
})
watch(currentIdentity, identity => {
  if (pendingIdentity.value === identity) pendingIdentity.value = null
}, { flush: "sync" })
const acceptedIdentity = computed(() => pendingIdentity.value ?? currentIdentity.value)
const client = useLbApiClient()
const profileHandoffs = useState<Partial<Record<string, ProfileResponse>>>(
  "author-profile-handoffs",
  () => ({})
)

const { data } = await useAsyncData<ProfileResponse>(
  asyncKey,
  async () => {
    const requestedAuthor = authorId.value
    const identity = `dramawebben:${requestedAuthor}`
    const handoffKey = identity
    const handoff = profileHandoffs.value[handoffKey]
    if (handoff?.identity === identity) {
      profileHandoffs.value[handoffKey] = undefined
      return handoff
    }
    if (handoff) profileHandoffs.value[handoffKey] = undefined
    try {
      const { data: profile, response } = await client.GET("/authors/{author_id}", {
        params: { path: { author_id: requestedAuthor } }
      })
      const hasDramawebben = Boolean(profile?.dramawebben)
      return {
        identity,
        view: profile
          ? createAuthorProfileView(profile, hasDramawebben ? "dramawebben" : "ordinary")
          : null,
        status: profile ? 200 : response.status === 404 ? 404 : 503,
        canonicalPath: profile?.canonical_path ?? "",
        hasDramawebben
      }
    } catch {
      return { identity, view: null, status: 503, canonicalPath: "", hasDramawebben: false }
    }
  },
  { lazy: true }
)

const response = computed(() => (
  data.value?.identity === acceptedIdentity.value ? data.value : null
))

if (import.meta.server && response.value?.status !== 200) {
  setResponseStatus(response.value?.status === 404 ? 404 : 503)
}

const redirectedIdentity = shallowRef("")
async function redirectToCanonical(candidate: ProfileResponse | null, identity: string) {
  // The profile API derives canonicalPath from the requested author id and uses
  // it to select the default profile variant. A profile with both ordinary and
  // Dramawebben introductions is canonically rooted at the ordinary page, but
  // its explicit /dramawebben variant must remain addressable. Only profiles
  // without Dramawebben content leave this route.
  if (!candidate || candidate.identity !== identity
    || candidate.status !== 200 || candidate.hasDramawebben) return
  const requestedAuthor = identity.slice("dramawebben:".length)
  const canonicalPath = authorProfilePath(requestedAuthor)
  const redirectIdentity = `${identity}:${canonicalPath}:${route.fullPath}`
  if (redirectedIdentity.value === redirectIdentity) return
  redirectedIdentity.value = redirectIdentity
  if (import.meta.client) {
    const targetIdentity = `ordinary:${requestedAuthor}`
    profileHandoffs.value[targetIdentity] = { ...candidate, identity: targetIdentity }
  }
  await navigateTo(
    { path: canonicalPath, query: route.query },
    { redirectCode: 307, replace: true }
  )
}

if (import.meta.server) {
  await redirectToCanonical(response.value, currentIdentity.value)
} else {
  watch(
    [response, currentIdentity, () => route.fullPath],
    ([candidate, identity]) => {
      void redirectToCanonical(candidate, identity)
    },
    { immediate: true, flush: "sync" }
  )
}

const view = computed(() => response.value?.view ?? null)
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
    <div
      v-if="!response"
      class="searching"
      role="status"
      aria-live="polite"
      aria-label="Laddar författarsidan"
    >
      <div class="preloader">
        <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
        <span class="sr-only">Laddar författarsidan</span>
      </div>
    </div>
    <div v-else-if="response.status === 404" class="error">
      Ett fel har inträffat: författarid <code>{{ authorId }}</code> kan inte hittas. Kontrollera adressen.
    </div>
    <div v-else-if="response && response.status !== 200" class="error">
      Ett fel har inträffat. Författarprofilen kan inte visas just nu.
    </div>
    <AuthorProfileContent v-else-if="view" :profile="view" variant="dramawebben" />
  </div>
</template>

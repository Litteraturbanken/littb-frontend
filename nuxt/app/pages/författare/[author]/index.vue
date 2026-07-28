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
const config = useRuntimeConfig()
const authorId = computed(() => {
  const value = Array.isArray(route.params.author) ? route.params.author[0] : route.params.author
  return typeof value === "string" ? value : ""
})
const asyncKey = computed(() => `author-profile:ordinary:${authorId.value}`)
const currentIdentity = computed(() => `ordinary:${authorId.value}`)
const pendingIdentity = shallowRef<string | null>(null)
onBeforeRouteUpdate(to => {
  const value = Array.isArray(to.params.author) ? to.params.author[0] : to.params.author
  pendingIdentity.value = `ordinary:${typeof value === "string" ? value : ""}`
})
watch(currentIdentity, identity => {
  if (pendingIdentity.value === identity) pendingIdentity.value = null
}, { flush: "sync" })
const acceptedIdentity = computed(() => pendingIdentity.value ?? currentIdentity.value)
const client = createLbApiClient(import.meta.server ? config.apiBase : config.public.apiBase)
const profileHandoffs = useState<Partial<Record<string, ProfileResponse>>>(
  "author-profile-handoffs",
  () => ({})
)

function clientAuthorPath(path: string): string {
  return path.replace(/^\/författare(?=\/|$)/u, "/f%C3%B6rfattare")
}

const { data } = await useAsyncData<ProfileResponse>(
  asyncKey,
  async () => {
    const requestedAuthor = authorId.value
    const identity = `ordinary:${requestedAuthor}`
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
      const canonicalPath = profile?.canonical_path ?? ""
      const isDramawebbenCanonical = Boolean(profile?.dramawebben)
        && clientAuthorPath(canonicalPath) === authorProfilePath(requestedAuthor, "dramawebben")
      return {
        identity,
        view: profile
          ? createAuthorProfileView(profile, isDramawebbenCanonical ? "dramawebben" : "ordinary")
          : null,
        status: profile ? 200 : response.status === 404 ? 404 : 503,
        canonicalPath,
        hasDramawebben: Boolean(profile?.dramawebben)
      }
    } catch {
      return { identity, view: null, status: 503, canonicalPath: "", hasDramawebben: false }
    }
  }
)

const response = computed(() => (
  data.value?.identity === acceptedIdentity.value ? data.value : null
))

if (import.meta.server && response.value?.status !== 200) {
  setResponseStatus(response.value?.status === 404 ? 404 : 503)
}

const redirectedIdentity = shallowRef("")
async function redirectToCanonical(candidate: ProfileResponse | null, identity: string) {
  if (!candidate || candidate.identity !== identity || !candidate.canonicalPath) return
  const requestedAuthor = identity.slice("ordinary:".length)
  const rootPath = authorProfilePath(requestedAuthor)
  const canonicalPath = clientAuthorPath(candidate.canonicalPath)
  if (canonicalPath !== rootPath) {
    const redirectIdentity = `${identity}:${canonicalPath}:${route.fullPath}`
    if (redirectedIdentity.value === redirectIdentity) return
    redirectedIdentity.value = redirectIdentity
    if (
      import.meta.client
      && candidate.hasDramawebben
      && canonicalPath === authorProfilePath(requestedAuthor, "dramawebben")
    ) {
      const targetIdentity = `dramawebben:${requestedAuthor}`
      profileHandoffs.value[targetIdentity] = { ...candidate, identity: targetIdentity }
    }
    await navigateTo(
      { path: canonicalPath, query: route.query },
      { redirectCode: 307, replace: true }
    )
  }
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
    <div v-if="response?.status === 404" class="error">
      Ett fel har inträffat: författarid <code>{{ authorId }}</code> kan inte hittas. Kontrollera adressen.
    </div>
    <div v-else-if="response && response.status !== 200" class="error">
      Ett fel har inträffat. Författarprofilen kan inte visas just nu.
    </div>
    <AuthorProfileContent v-else-if="view" :profile="view" variant="ordinary" />
  </div>
</template>

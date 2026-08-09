<script setup lang="ts">
import AuthorWorksContent from "~/components/author/AuthorWorksContent.vue"
import ordinaryBackground from "~/assets/img/forf2_bkg.jpg"
import { useLbApiClient } from "~/composables/useLbApiClient"
import {
  isAuthorWorksResponse,
  type AuthorWorksResponse
} from "~/lib/author-works"
import { validateAuthorRouteParam } from "~/lib/author-profile"

type WorksPageResponse = {
  identity: string
  status: number
  works: AuthorWorksResponse | null
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
const currentIdentity = computed(() => `titlar:${authorId.value}`)
const asyncKey = computed(() => `author-works:${currentIdentity.value}`)
const client = useLbApiClient()

const { data } = await useAsyncData<WorksPageResponse>(
  asyncKey,
  async () => {
    const requestedAuthorId = authorId.value
    const identity = `titlar:${requestedAuthorId}`
    try {
      const { data: body, response } = await client.GET("/authors/{author_id}/works", {
        params: { path: { author_id: requestedAuthorId } }
      })
      if (
        response.status === 200
        && isAuthorWorksResponse(body)
        && body.author.author_id === requestedAuthorId
      ) {
        return { identity, status: 200, works: body }
      }
      return {
        identity,
        status: response.status === 404 ? 404 : 503,
        works: null
      }
    } catch {
      return { identity, status: 503, works: null }
    }
  },
  {
    lazy: true,
    getCachedData: (key, nuxtApp) => {
      const cached = nuxtApp.payload.data[key] as WorksPageResponse | undefined
      return cached?.identity === currentIdentity.value ? cached : undefined
    }
  }
)

const accepted = shallowRef<WorksPageResponse | null>(null)
watch(currentIdentity, () => {
  accepted.value = null
}, { flush: "sync" })
watch([data, currentIdentity], ([candidate, identity]) => {
  if (candidate?.identity === identity) accepted.value = candidate
}, { immediate: true, flush: "sync" })

if (import.meta.server && accepted.value?.status !== 200) {
  setResponseStatus(accepted.value?.status === 404 ? 404 : 503)
}

const works = computed(() => accepted.value?.status === 200
  ? accepted.value.works
  : null)
useAuthorQuickSearchContextPublisher(computed(() => works.value?.author ?? null))
const description = computed(() => works.value
  ? `${works.value.author.full_name}, Tillgängliga verk`
  : "Författarverk")

useSeoMeta({
  title: () => works.value
    ? `${works.value.author.full_name}, Tillgängliga verk | Litteraturbanken`
    : "Författarverk | Litteraturbanken",
  description
})
useHead({
  htmlAttrs: { style: `background: url('${ordinaryBackground}') no-repeat;` },
  bodyAttrs: { class: "focus page-authorInfo ready" }
})
</script>

<template>
  <div>
    <div v-if="!accepted" class="searching" aria-live="polite">
      <div class="preloader">
        <i class="spinner fa fa-spinner fa-pulse" aria-hidden="true" />
        <span class="sr-only">Laddar författarens verk</span>
      </div>
    </div>
    <div v-else-if="accepted.status === 404" class="error">
      Ett fel har inträffat: författarid <code>{{ authorId }}</code> kan inte hittas. Kontrollera adressen.
    </div>
    <div v-else-if="accepted.status !== 200 || !works" class="error">
      Ett fel har inträffat. Författarens verk kan inte visas just nu.
    </div>
    <AuthorWorksContent v-else :response="works" variant="titlar" />
  </div>
</template>

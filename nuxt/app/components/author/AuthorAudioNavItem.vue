<script setup lang="ts">
import { safeHttpUrl } from "~/lib/author-profile"

const props = defineProps<{ authorId: string, initialUrl?: string }>()
const client = useLbApiClient()
// Optional WordPress data must never hold the profile, title or router suspense.
const { data } = useLazyAsyncData(
  () => `author-audio:${props.authorId}`,
  async () => {
    const identity = props.authorId
    try {
      const { data: audio } = await client.GET("/authors/{author_id}/audio", {
        params: { path: { author_id: identity } }
      })
      return { identity, url: safeHttpUrl(audio?.audio_url) }
    } catch { return { identity, url: "" } }
  },
  { server: false }
)
const url = computed(() => props.initialUrl
  || (data.value?.identity === props.authorId ? data.value.url : ""))
</script>

<template>
  <li v-if="url"><a :href="url" target="_blank" rel="noopener noreferrer">Ljud</a></li>
</template>

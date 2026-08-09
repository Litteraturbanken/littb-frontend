<script setup lang="ts">
import {
  canonicalNuxtHref,
  isNuxtInternalHref,
  safeNativeHref
} from "~/lib/internal-navigation"

const props = defineProps<{
  label: string
  url: string
}>()

const internalHref = computed(() => isNuxtInternalHref(props.url)
  ? canonicalNuxtHref(props.url)
  : null)
const nativeHref = computed(() => internalHref.value === null
  ? safeNativeHref(props.url)
  : null)
</script>

<template>
  <NuxtLink v-if="internalHref" :to="internalHref">{{ label }}</NuxtLink>
  <a v-else-if="nativeHref" :href="nativeHref">{{ label }}</a>
  <span v-else>{{ label }}</span>
</template>

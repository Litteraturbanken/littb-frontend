<script setup lang="ts">
import { authorProfilePath, type AuthorProfileView } from "~/lib/author-profile"
import { canonicalNuxtHref, isNuxtInternalHref } from "~/lib/internal-navigation"
import {
  copyProductionValue,
  isProductionShortcutGuarded
} from "~/lib/production-shortcuts"

const props = defineProps<{
  profile: AuthorProfileView
  variant: "ordinary" | "dramawebben"
}>()

const rootHref = computed(() => authorProfilePath(props.profile.authorId))
const titlesHref = computed(() => authorProfilePath(props.profile.authorId, "titlar"))
const dramawebbenHref = computed(() => authorProfilePath(props.profile.authorId, "dramawebben"))
const shortcutMessage = ref("")
let shortcutMessageTimer: ReturnType<typeof setTimeout> | null = null

function showShortcutMessage(message: string): void {
  shortcutMessage.value = message
  if (shortcutMessageTimer) clearTimeout(shortcutMessageTimer)
  shortcutMessageTimer = setTimeout(() => {
    shortcutMessage.value = ""
    shortcutMessageTimer = null
  }, 2200)
}

async function handleAuthorShortcut(event: KeyboardEvent): Promise<void> {
  if (event.key !== "i" || isProductionShortcutGuarded(event)) return
  event.preventDefault()
  if (await copyProductionValue(props.profile.authorId)) {
    showShortcutMessage("Kopierade authorid")
  } else {
    showShortcutMessage("Kunde inte kopiera authorid")
  }
}

onMounted(() => document.addEventListener("keydown", handleAuthorShortcut))
onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleAuthorShortcut)
  if (shortcutMessageTimer) clearTimeout(shortcutMessageTimer)
})
</script>

<template>
  <div>
    <LegacyNotice :message="shortcutMessage" />
    <h1 class="text-balance max-w-5xl">
      {{ profile.fullName }}{{ " " }}<span v-if="profile.lifespan" class="author_year">({{ profile.lifespan }})</span>
    </h1>

    <nav aria-label="Författarsidor">
      <ul class="links">
        <li v-if="profile.hasOrdinaryIntroduction" :class="{ active: variant === 'ordinary' }">
          <NuxtLink
            :to="rootHref"
            :aria-current="variant === 'ordinary' ? 'page' : undefined"
          >Introduktion</NuxtLink>
        </li>{{ " " }}
        <li>
          <NuxtLink :to="titlesHref">Verk</NuxtLink>
        </li>{{ " " }}
        <li v-if="profile.hasDramawebben" :class="{ active: variant === 'dramawebben' }">
          <NuxtLink
            :to="dramawebbenHref"
            :aria-current="variant === 'dramawebben' ? 'page' : undefined"
          >Dramawebben</NuxtLink>
        </li>{{ " " }}
        <li v-if="profile.searchUrl">
          <NuxtLink :to="canonicalNuxtHref(profile.searchUrl)">Sök i texterna</NuxtLink>
        </li>
      </ul>
    </nav>

    <div class="page_content">
      <div
        v-if="variant === 'ordinary'"
        class="lg:flex"
        :class="{
          'author-profile-sections--empty': !profile.portrait
            && !profile.relatedLinks.length
            && !profile.mapUrl
            && !profile.encyclopediaLinks.length
        }"
      >
        <div class="introtext content unbox show_more">
          <div v-html="profile.introductionHtml" />
          <div v-if="profile.introductionBy" class="introauthor">
            <em>{{ profile.introductionBy }}</em>
          </div>
          <div v-if="profile.sourceHtml.length" class="source">
            <span class="source_header sc">
              {{ profile.sourceHtml.length === 1 ? "Källa" : "Källor" }}
            </span>
            <ul>
              <li v-for="(source, index) in profile.sourceHtml" :key="index">
                <div class="source_content" v-html="source" />
              </li>
            </ul>
          </div>
          <div v-if="profile.pseudonymNames.length" class="pseudonym">
            <span class="sc">Pseudonym<span v-if="profile.pseudonymNames.length > 1">er</span></span>{{ " " }}
            <template v-for="(name, index) in profile.pseudonymNames" :key="name">
              <em>{{ name }}</em><span v-if="index < profile.pseudonymNames.length - 1">, </span>
            </template>
          </div>
          <div v-if="profile.otherNames.length" class="other_name">
            <span class="sc">Andra namn</span>{{ " " }}
            <template v-for="(name, index) in profile.otherNames" :key="name">
              <em>{{ name }}</em><span v-if="index < profile.otherNames.length - 1">, </span>
            </template>
          </div>
        </div>

        <div
          v-if="profile.portrait || profile.relatedLinks.length || profile.mapUrl || profile.encyclopediaLinks.length"
          class="portrait_container lg:ml-8"
        >
          <div v-if="profile.portrait" class="shadow-lg mt-2">
            <img
              class="author_img border border-gray-500 border-opacity-50"
              :src="profile.portrait.url"
              :alt="`Porträtt av ${profile.fullName}`"
            >
            <figcaption
              v-if="profile.portrait.captionHtml"
              class="bg-white bg-opacity-75 p-3 text-base"
              v-html="profile.portrait.captionHtml"
            />
          </div>

          <div
            v-if="profile.relatedLinks.length || profile.mapUrl"
            class="ext_links w-100 border border-gray-400 p-4 mt-4 bg-white bg-opacity-75 max-w-xs"
          >
            <h3 class="sc mt-0">Mer om författarskapet</h3>
            <section>
              <ul class="list-item pl-4">
                <li v-for="link in profile.relatedLinks" :key="link.url">
                  <NuxtLink
                    v-if="isNuxtInternalHref(link.url)"
                    :to="canonicalNuxtHref(link.url)"
                  >{{ link.label }}</NuxtLink>
                  <a v-else :href="link.url">{{ link.label }}</a>
                </li>
                <li v-if="profile.mapUrl">
                  <a :href="profile.mapUrl" target="_blank" rel="noopener noreferrer">Litteraturkartan</a>
                </li>
              </ul>
            </section>
          </div>

          <div
            v-if="profile.encyclopediaLinks.length"
            class="ext_links w-100 border border-gray-400 p-4 mt-4 bg-white bg-opacity-75"
          >
            <h3 class="sc mt-0">Författaren i uppslagsverk</h3>
            <ul class="list-item pl-4">
              <li v-for="link in profile.encyclopediaLinks" :key="link.url">
                <a :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div v-else>
        <div class="introtext content sm:inline-block show_more">
          <div v-html="profile.introductionHtml" />
          <div v-if="profile.introductionBy" class="introauthor">
            <em>{{ profile.introductionBy }}</em>
            <div class="drama_subtitle sc"><NuxtLink to="/dramawebben">Dramawebben</NuxtLink></div>
          </div>
          <div v-else class="introauthor">
            <div class="drama_subtitle sc"><NuxtLink to="/dramawebben">Dramawebben</NuxtLink></div>
          </div>
          <div v-if="profile.sourceHtml.length" class="source drama-source">
            <span class="source_header sc drama-source-header">Källa</span>
            <span class="sc drama-source-header__visual" aria-hidden="true">Källor</span>
            <ul>
              <li v-for="(source, index) in profile.sourceHtml" :key="index">
                <div class="source_content" v-html="source" />
              </li>
            </ul>
          </div>
          <div v-if="profile.pseudonymNames.length" class="pseudonym">
            <span class="sc">Pseudonym<span v-if="profile.pseudonymNames.length > 1">er</span></span>{{ " " }}
            <template v-for="(name, index) in profile.pseudonymNames" :key="name">
              <em>{{ name }}</em><span v-if="index < profile.pseudonymNames.length - 1">, </span>
            </template>
          </div>
          <div v-if="profile.otherNames.length" class="other_name">
            <span class="sc">Andra namn</span>{{ " " }}
            <template v-for="(name, index) in profile.otherNames" :key="name">
              <em>{{ name }}</em><span v-if="index < profile.otherNames.length - 1">, </span>
            </template>
          </div>
        </div>{{ " " }}
        <div v-if="profile.portrait" class="portrait_container sm:inline-block sm:ml-8">
          <img
            class="author_img"
            :src="profile.portrait.url"
            :alt="`Porträtt av ${profile.fullName}`"
          >
          <figcaption v-if="profile.portrait.captionHtml" v-html="profile.portrait.captionHtml" />
        </div>
      </div>
    </div>
  </div>
</template>

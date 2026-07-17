<script setup lang="ts">
import type { AuthorProfileView } from "~/lib/author-profile"

const props = defineProps<{
  profile: AuthorProfileView
  variant: "ordinary" | "dramawebben"
}>()

const encodedAuthorId = computed(() => encodeURIComponent(props.profile.authorId))
const rootHref = computed(() => `/f%C3%B6rfattare/${encodedAuthorId.value}`)
const titlesHref = computed(() => `${rootHref.value}/titlar`)
const dramawebbenHref = computed(() => `${rootHref.value}/dramawebben`)
</script>

<template>
  <div>
    <h1 class="text-balance max-w-5xl">
      {{ profile.fullName }}<span v-if="profile.lifespan" class="author_year"> ({{ profile.lifespan }})</span>
    </h1>

    <nav aria-label="Författarsidor">
      <ul class="links">
        <li v-if="profile.hasOrdinaryIntroduction" :class="{ active: variant === 'ordinary' }">
          <a
            :href="rootHref"
            :aria-current="variant === 'ordinary' ? 'page' : undefined"
          >Introduktion</a>
        </li>
        <li>
          <a :href="titlesHref">Verk</a>
        </li>
        <li v-if="profile.hasDramawebben" :class="{ active: variant === 'dramawebben' }">
          <a
            :href="dramawebbenHref"
            :aria-current="variant === 'dramawebben' ? 'page' : undefined"
          >Dramawebben</a>
        </li>
        <li v-if="profile.searchUrl">
          <a :href="profile.searchUrl">Sök i texterna</a>
        </li>
      </ul>
    </nav>

    <div class="page_content">
      <div v-if="variant === 'ordinary'" class="lg:flex">
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
          v-if="profile.portrait || profile.relatedLinks.length || profile.encyclopediaLinks.length"
          class="portrait_container lg:ml-8"
        >
          <div v-if="profile.portrait" class="shadow-lg mt-2">
            <img
              class="author_img border border-gray-500 border-opacity-50"
              :src="profile.portrait.url"
            >
            <figcaption
              v-if="profile.portrait.captionHtml"
              class="bg-white bg-opacity-75 p-3 text-base"
              v-html="profile.portrait.captionHtml"
            />
          </div>

          <div
            v-if="profile.relatedLinks.length"
            class="ext_links w-100 border border-gray-400 p-4 mt-4 bg-white bg-opacity-75 max-w-xs"
          >
            <h3 class="sc mt-0">Mer om författarskapet</h3>
            <section>
              <ul class="list-item pl-4">
                <li v-for="link in profile.relatedLinks" :key="link.url">
                  <a :href="link.url">{{ link.label }}</a>
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
            <div class="drama_subtitle sc"><a href="/dramawebben">Dramawebben</a></div>
          </div>
          <div v-else class="introauthor">
            <div class="drama_subtitle sc"><a href="/dramawebben">Dramawebben</a></div>
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
        <div v-if="profile.portrait" class="portrait_container sm:inline-block sm:ml-8">
          <img class="author_img" :src="profile.portrait.url">
          <figcaption v-if="profile.portrait.captionHtml" v-html="profile.portrait.captionHtml" />
        </div>
      </div>
    </div>
  </div>
</template>

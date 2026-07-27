<script setup lang="ts">
import {
  hasAuthorWorksAboutContent,
  isInfopostTitle,
  orderedAuthorWorkActions,
  type AuthorWork,
  type AuthorWorksResponse
} from "~/lib/author-works"
import {
  authorProfilePath,
  formatAuthorYears,
  sanitizeAuthorHtml
} from "~/lib/author-profile"
import { canonicalNuxtHref, isNuxtInternalHref } from "~/lib/internal-navigation"

const props = defineProps<{
  response: AuthorWorksResponse
  variant: "titlar" | "mer"
}>()

const author = computed(() => props.response.author)
const lifespan = computed(() => formatAuthorYears(
  author.value.birth_year,
  author.value.death_year
))
const sections = computed(() => props.variant === "titlar"
  ? props.response.authored_sections
  : props.response.about_sections)
const rootHref = computed(() => authorProfilePath(author.value.author_id))
const titlesHref = computed(() => authorProfilePath(author.value.author_id, "titlar"))
const moreHref = computed(() => authorProfilePath(author.value.author_id, "mer"))
const dramawebbenHref = computed(() => (
  authorProfilePath(author.value.author_id, "dramawebben")
))
const hasAboutContent = computed(() => hasAuthorWorksAboutContent(props.response))
const portraitCaptionHtml = computed(() => sanitizeAuthorHtml(
  author.value.portrait?.caption_html ?? ""
))
const hasAuthorshipLinks = computed(() => (
  hasAboutContent.value
  || author.value.related_links.length > 0
  || Boolean(author.value.map_url)
))

function isDownloadTitle(work: AuthorWork): boolean {
  return work.actions.some(action => (
    action.kind === "download" && action.url === work.title_url
  ))
}
</script>

<template>
  <div>
    <h1 class="text-balance max-w-5xl">
      {{ author.full_name }}{{ " " }}<span v-if="lifespan" class="author_year">({{ lifespan }})</span>
    </h1>

    <nav aria-label="Författarsidor">
      <ul class="links">
        <li v-if="author.has_introduction">
          <NuxtLink :to="rootHref">Introduktion</NuxtLink>
        </li>{{ " " }}
        <li :class="{ active: variant === 'titlar' }">
          <NuxtLink :to="titlesHref" :aria-current="variant === 'titlar' ? 'page' : undefined">Verk</NuxtLink>
        </li>{{ " " }}
        <li v-if="author.audio_url">
          <a :href="author.audio_url" target="_blank" rel="noopener noreferrer">Ljud</a>
        </li>{{ " " }}
        <li v-if="author.has_dramawebben">
          <NuxtLink :to="dramawebbenHref">Dramawebben</NuxtLink>
        </li>{{ " " }}
        <li v-if="author.search_url">
          <NuxtLink :to="canonicalNuxtHref(author.search_url)">Sök i texterna</NuxtLink>
        </li>
      </ul>
    </nav>

    <div class="page_content">
      <div :class="variant === 'titlar' ? 'flex' : undefined">
        <div class="unbox">
          <template v-for="section in sections" :key="section.kind">
            <div v-if="section.items.length">
              <h2>{{ section.label }}</h2>

              <table class="contenttable" :class="{ extra_wide: section.show_author }">
                <tbody>
                  <tr v-for="work in section.items" :key="`${work.work_id}:${work.title_id}`">
                    <td class="mediatypes">
                      <span
                        v-for="(action, actionIndex) in orderedAuthorWorkActions(work.actions)"
                        :key="`${action.kind}:${action.media_type}:${action.url}`"
                      >
                        <a
                          v-if="action.kind === 'download'"
                          :href="action.url"
                          target="_self"
                          :download="action.download_filename"
                        >{{ action.media_type }}</a>
                        <NuxtLink v-else :to="canonicalNuxtHref(action.url)">{{ action.media_type }}</NuxtLink>
                        <span
                          v-if="actionIndex < work.actions.length - 1"
                        ><span>&nbsp;</span><span>&nbsp;</span><span>&nbsp;</span></span>
                        <span v-else>&nbsp;&nbsp;</span>
                      </span>
                    </td>
                    <td v-if="section.show_author">
                      <NuxtLink v-if="work.display_author" :to="canonicalNuxtHref(work.display_author.url)">
                        {{ work.display_author.name_for_index }}
                      </NuxtLink>
                    </td>
                    <td>
                      <span class="title" :title="work.title_tooltip ?? undefined">
                        <a v-if="isDownloadTitle(work)" :href="work.title_url" target="_self">
                          {{ work.short_title || work.title }}<template
                            v-if="work.imprint_year && !isInfopostTitle(work)"
                          >{{ " " }}<span>({{ work.imprint_year }})</span></template>
                        </a>
                        <NuxtLink v-else :to="canonicalNuxtHref(work.title_url)">
                          {{ work.short_title || work.title }}<template
                            v-if="work.imprint_year && !isInfopostTitle(work)"
                          >{{ " " }}<span>({{ work.imprint_year }})</span></template>
                        </NuxtLink>
                      </span>
                      <div v-if="work.containing_work" class="extras">i{{ " " }}<NuxtLink
                        class="author"
                        :to="canonicalNuxtHref(work.containing_work.author.url)"
                      >{{ work.containing_work.author.surname }}:</NuxtLink>{{ " " }}<span
                        class="extras_title"
                      >{{ work.containing_work.title }}</span><template
                        v-if="work.imprint_year"
                      >{{ " " }}<span>({{ work.imprint_year }})</span></template></div>
                      <span class="dots" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <div v-if="variant === 'titlar'" class="portrait_container lg:ml-8">
          <div v-if="author.portrait" class="shadow-lg mt-2">
            <img
              class="author_img border border-gray-500 border-opacity-50"
              :src="author.portrait.url"
              :alt="`Porträtt av ${author.full_name}`"
            >
            <RenderableHtmlContent
              v-if="portraitCaptionHtml"
              as="figcaption"
              class="bg-white bg-opacity-75 p-3 text-base"
              :html="portraitCaptionHtml"
            />
          </div>

          <div
            v-if="hasAuthorshipLinks"
            class="ext_links w-100 border border-gray-400 p-4 mt-4 bg-white bg-opacity-75 max-w-xs"
          >
            <h3 class="sc mt-0">Mer om författarskapet</h3>
            <section>
              <ul class="list-item pl-4">
                <li v-if="hasAboutContent">
                  <NuxtLink :to="moreHref">Texter om {{ author.full_name }}</NuxtLink>
                </li>
                <li v-for="link in author.related_links" :key="link.url">
                  <NuxtLink
                    v-if="isNuxtInternalHref(link.url)"
                    :to="canonicalNuxtHref(link.url)"
                  >{{ link.label }}</NuxtLink>
                  <a v-else :href="link.url">{{ link.label }}</a>
                </li>
                <li v-if="author.map_url">
                  <a
                    :href="author.map_url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >Litteraturkartan</a>
                </li>
              </ul>
            </section>
          </div>

          <div
            v-if="author.encyclopedia_links.length"
            class="ext_links w-100 border border-gray-400 p-4 mt-4 bg-white bg-opacity-75"
          >
            <h3 class="sc mt-0">Författaren i uppslagsverk</h3>
            <ul class="list-item pl-4">
              <li v-for="link in author.encyclopedia_links" :key="link.url">
                <a
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ link.label }}</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/vue"

import type {
  ReaderSourceInfo,
  ReaderSourceInfoDramaFact
} from "#shared/types/reader-source-info"
import type { components } from "~/lib/api/generated/lbapi"

type SimilarWork = components["schemas"]["SimilarWork"]

const props = withDefaults(defineProps<{
  open: boolean
  loading: boolean
  failed: boolean
  sourceInfo: ReaderSourceInfo | null
  similarWorks?: SimilarWork[]
}>(), {
  similarWorks: () => []
})

const emit = defineEmits<{ close: [] }>()

const headlessReady = ref(false)
const modalRoot = ref<HTMLElement | null>(null)
const errataOpen = ref(false)
const defaultErrataLimit = 8

const dramaLabels: Record<ReaderSourceInfoDramaFact["key"], string> = {
  first_staged: "Urpremiär",
  first_staged_in_sweden: "Svensk premiär",
  number_of_roles: "Antal roller",
  male_roles: "Antal män",
  female_roles: "Antal kvinnor",
  other_roles: "Antal övriga",
  number_of_pages: "Antal sidor",
  number_of_acts: "Antal akter"
}

function fileSize(size: number | null): string | null {
  if (size === null) return null
  const kilobytes = size / 1024
  return kilobytes < 1024
    ? `${Math.round(kilobytes)} KB`
    : `${Math.round((kilobytes / 1024) * 10) / 10} MB`
}

function toggleErrata(): void {
  errataOpen.value = !errataOpen.value
}

function authorRole(authorType: string | null, role: string | null): string | null {
  const value = (authorType ?? role ?? "").toLowerCase()
  if (value === "editor" || value === "redaktör") return "red."
  if (value === "translator" || value === "översättare") return "övers."
  if (value === "illustrator" || value === "illustratör") return "ill."
  if (value === "photographer" || value === "fotograf") return "fotogr."
  return null
}

function hideBrokenImage(event: Event): void {
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.style.display = "none"
  }
}

function similarWorkHref(work: SimilarWork): string {
  return [
    "",
    "författare",
    work.author_id,
    "titlar",
    work.title_id,
    "sida",
    work.start_page,
    work.media_type
  ].map((segment, index) => index === 0 ? segment : encodeURIComponent(segment)).join("/")
}

watch(() => props.sourceInfo?.workId, () => {
  errataOpen.value = false
})

onMounted(() => {
  // Headless UI portals dialogs only on the client. Keep the same markup in the
  // server response and during hydration, then hand interaction over to Dialog.
  headlessReady.value = true
})
</script>

<template>
  <component
    ref="modalRoot"
    :is="headlessReady ? Dialog : 'div'"
    v-if="open"
    :open="headlessReady ? open : undefined"
    :initial-focus="headlessReady ? modalRoot : undefined"
    :role="headlessReady ? undefined : 'dialog'"
    :aria-modal="headlessReady ? undefined : 'true'"
    as="div"
    class="modal about fade in"
    tabindex="-1"
    @close="emit('close')"
  >
    <div class="modal-backdrop fade in" aria-hidden="true" />
    <div class="modal-dialog">
      <component
        :is="headlessReady ? DialogPanel : 'div'"
        class="modal-content"
        tabindex="-1"
      >
        <div class="about-modal modal-body">
          <button
            class="close_btn submit btn pull-right"
            type="button"
            @click="emit('close')"
          >Stäng</button>
          <component
            :is="headlessReady ? DialogTitle : 'h2'"
            class="sr-only"
          >Om boken</component>

          <div class="maincontent" :class="{ searching: loading }">
            <div v-if="loading" class="preloader">Hämtar <span class="dots_blink" /></div>
            <div v-else-if="failed" class="error" role="alert">Ett fel har uppstått.</div>

            <template v-else-if="sourceInfo">
            <div class="header header_left">
              <h2 class="author sc">
                <template v-for="(author, index) in sourceInfo.authors" :key="author.authorId">
                  <template v-if="index > 0"><template
                    v-if="index === sourceInfo.authors.length - 1"
                    > <em class="font-normal">&amp;</em> </template><template v-else>, </template></template><a
                    :href="author.url"
                  >{{ author.fullName }} <span
                    v-if="authorRole(author.authorType, author.role)"
                    class="authortype"
                  >{{ authorRole(author.authorType, author.role) }}</span></a>
                </template>
              </h2>
              <h2 class="title"><span>{{ sourceInfo.title }}</span></h2>
            </div>

            <div class="columns">
              <div class="col_left">
                <div
                  v-if="sourceInfo.sourceDescriptionHtml"
                  class="sourcedesc"
                  v-html="sourceInfo.sourceDescriptionHtml"
                />
                <div class="mb-8 text-right italic">{{
                  sourceInfo.sourceDescriptionAuthor?.fullName ?? ""
                }}</div>

                <div
                  v-if="sourceInfo.readActions.length"
                  class="mediatypes"
                  :class="{ larger: sourceInfo.workIntroductionHtml }"
                >Läs som <template
                  v-for="(action, index) in sourceInfo.readActions"
                  :key="action.mediaType"
                ><a
                  v-if="index === 0"
                  class="sc hover:underline"
                  :href="action.url"
                >{{ action.label }}</a><span v-else>
                  eller <a
                    class="sc hover:underline"
                    :href="action.url"
                  >{{ action.label }}</a>
                </span></template></div>

                <div
                  v-if="sourceInfo.downloadActions.length"
                  class="mediatypes_also"
                  :class="{ larger: sourceInfo.workIntroductionHtml }"
                >Ladda ner <span
                  v-for="(action, index) in sourceInfo.downloadActions"
                  :key="action.mediaType"
                ><template v-if="index > 0 && index === sourceInfo.downloadActions.length - 1">{{ " " }}<span>eller</span>{{ " " }}</template><a
                  class="sc hover:underline"
                  :href="action.url"
                  target="_self"
                  :download="action.filename"
                >{{ action.label }} <span v-if="fileSize(action.sizeBytes)">({{ fileSize(action.sizeBytes) }})</span>
                  </a>
                </span></div>

                <div
                  v-if="sourceInfo.librisId"
                  class="mediatypes sc"
                  :class="{ larger: sourceInfo.workIntroductionHtml }"
                >
                  Verket i <a
                    class="hover:underline"
                    :href="`https://libris.kb.se/bib/${encodeURIComponent(sourceInfo.librisId)}`"
                    target="_blank"
                    rel="noopener noreferrer"
                  >Libris</a>
                </div>

                <div v-if="sourceInfo.urn">
                  <details class="urn mt-2 text-sm cursor-pointer">
                    <summary>Hänvisa till detta verk</summary>
                    <div class="cursor-auto ml-4 border-l pl-4 mt-2">
                      <p>URN är en permanent länk till ett digitalt objekt. Denna
                        {{ sourceInfo.mediaType }}s URN är:
                        <code class="text-xs">https://urn.kb.se/resolve?urn={{ sourceInfo.urn }}</code>
                      </p>
                      <p class="mt-2">Använd denna länk när du hänvisar till verket
                        så hittar du till fram även om det skulle flyttas i framtiden.</p>
                      <p class="mt-2"><a
                        href="https://www.kb.se/isbn-och-utgivning/urnnbn.html"
                        target="_blank"
                        rel="noopener noreferrer"
                      >Läs mer om URN (extern länk).</a></p>
                    </div>
                  </details>
                </div>
              </div>

              <div class="col_right">
                <img
                  class="border border-gray-200"
                  :src="sourceInfo.cover.smallUrl"
                  :srcset="`${sourceInfo.cover.smallUrl} 1x, ${sourceInfo.cover.largeUrl} 2x`"
                  width="200"
                  alt=""
                  @error="hideBrokenImage"
                >
              </div>
            </div>

            <div
              v-if="sourceInfo.workIntroductionHtml"
              class="workintro mt-4"
              v-html="sourceInfo.workIntroductionHtml"
            />
            <div class="mb-8 text-right italic">{{
              sourceInfo.workIntroductionAuthor?.fullName ?? ""
            }}</div>

            <div v-if="sourceInfo.dramawebben" class="dramaweb">
              <table>
                <thead />
                <tbody>
                  <tr v-for="fact in sourceInfo.dramawebben.facts" :key="fact.key">
                    <td>{{ dramaLabels[fact.key] }}</td>
                    <td>{{ fact.value }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-if="sourceInfo.dramawebben.rolesHtml.length">
                <h3 class="heading">Rollista</h3>
                <div v-html="sourceInfo.dramawebben.rolesHtml.join('<br>')" />
              </div>
              <div v-if="sourceInfo.dramawebben.historyHtml">
                <h3 class="heading">Teaterkritik</h3>
                <div class="history" v-html="sourceInfo.dramawebben.historyHtml" />
              </div>
            </div>

            <div
              v-for="(provenance, index) in sourceInfo.provenance"
              :key="`${provenance.fullName}:${index}`"
              class="provenance"
            >
              <a
                v-if="provenance.imageUrl"
                class="block mb-4"
                :href="provenance.link ?? undefined"
              >
                <img class="logo" width="75" height="75" :src="provenance.imageUrl" :alt="provenance.fullName">
              </a>
              <p v-if="provenance.text">{{ provenance.text }}</p>
            </div>

            <div
              v-if="sourceInfo.licenseHtml"
              class="license mt-4"
              :class="{ drama: sourceInfo.dramawebben }"
              v-html="sourceInfo.licenseHtml"
            />

            <div v-if="sourceInfo.mediaType === 'etext'" class="errata">
              <div v-if="sourceInfo.errata.length" class="header">
                I etexten har följande ändringar gjorts mot originalet:
              </div>
              <table class="errata_table">
                <tbody>
                  <tr
                    v-for="(row, rowIndex) in sourceInfo.errata.slice(
                      0,
                      errataOpen ? 1000 : defaultErrataLimit
                    )"
                    :key="rowIndex"
                  >
                    <td>{{ row.cellsHtml[0] ?? "" }}</td>
                    <td v-html="row.cellsHtml[1] ?? ''" />
                  </tr>
                </tbody>
              </table>
              <a
                v-if="sourceInfo.errata.length > defaultErrataLimit && !errataOpen"
                class="toggle sc"
                role="button"
                tabindex="0"
                @click="toggleErrata"
                @keydown.enter.prevent="toggleErrata"
                @keydown.space.prevent="toggleErrata"
              >Visa fler</a>
              <a
                v-else-if="errataOpen"
                class="toggle sc"
                role="button"
                tabindex="0"
                @click="toggleErrata"
                @keydown.enter.prevent="toggleErrata"
                @keydown.space.prevent="toggleErrata"
              >Visa färre</a>
            </div>

            <div class="clearfix" />

            <div v-if="similarWorks.length" class="reader-similar-works mt-4 text-sm">
              <hr class="mt-8 mb-4">
              <h3 class="text-lg">Läs gärna också</h3>
              <table>
                <tbody>
                  <tr v-for="work in similarWorks" :key="`${work.author_id}:${work.title_id}:${work.start_page}:${work.media_type}`">
                    <td class="text-right pr-4"><span class="sc text-primary">{{ work.author_surname }}</span></td>
                    <td><NuxtLink :to="similarWorkHref(work)">{{ work.label }}</NuxtLink></td>
                  </tr>
                </tbody>
              </table>
            </div>
            </template>
          </div>
        </div>
      </component>
    </div>
  </component>
</template>

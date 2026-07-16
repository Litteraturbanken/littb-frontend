<script setup lang="ts">
import AboutPageShell from "../../components/about/AboutPageShell.vue"
import { createLbApiClient } from "../../lib/api/client"

const angularEmail = /^(?=.{1,254}$)(?=.{1,64}@)[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+(\.[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/

useSeoMeta({
  title: "Om LB | Litteraturbanken",
  description: "Litteraturbankens kontaktforumlär och utskicksanmälan."
})

useHead({
  htmlAttrs: {
    style: "background: url('/assets/img/backgrounds/about_bkg.jpg') no-repeat;"
  },
  bodyAttrs: { class: "focus page-about ready" }
})

const route = useRoute()
const isSol = route.query.sol !== undefined
const fromSchool = route.query.skola !== undefined

const name = ref("")
const email = ref("")
const message = ref(isSol ? "[Ang. Översättarlexikon]\n\n" : "")
const newsletterEmail = ref("")

const nameDirty = ref(false)
const emailDirty = ref(false)
const messageDirty = ref(false)
const newsletterDirty = ref(false)

const showContact = ref(false)
const showNewsletter = ref(false)
const showError = ref(false)
const isLoading = ref(false)

const emailValid = computed(() => angularEmail.test(email.value))
const messageValid = computed(() => message.value.length > 0)
const contactDirty = computed(() => nameDirty.value || emailDirty.value || messageDirty.value)
const contactValid = computed(() => emailValid.value && messageValid.value)
const newsletterValid = computed(() => angularEmail.test(newsletterEmail.value))
const showForms = computed(() => !showContact.value && !showNewsletter.value && !showError.value)

const config = useRuntimeConfig()
const client = createLbApiClient(config.public.apiBase)

function hideSuccessAfterDelay() {
  window.setTimeout(() => {
    showContact.value = false
    showNewsletter.value = false
    name.value = ""
    email.value = ""
    message.value = ""
  }, 4_000)
}

function showFailure() {
  showError.value = true
  showContact.value = false
  showNewsletter.value = false
  isLoading.value = false
  window.setTimeout(() => {
    showError.value = false
  }, 4_000)
}

async function submitContactForm() {
  isLoading.value = true
  try {
    const { error: requestError } = await client.POST("/contact", {
      body: {
        sender_name: name.value || null,
        sender_address: email.value,
        message: fromSchool ? `[skola] ${message.value}` : message.value,
        audience: isSol ? "oversattarlexikon" : "litteraturbanken"
      },
      signal: AbortSignal.timeout(30_000)
    })
    if (requestError) return showFailure()
  } catch {
    return showFailure()
  }

  isLoading.value = false
  showContact.value = true
  hideSuccessAfterDelay()
}

async function subscribe() {
  try {
    const { error: requestError } = await client.POST("/contact", {
      body: {
        sender_name: "Utskickslista",
        sender_address: newsletterEmail.value,
        message: `${newsletterEmail.value} vill bli tillagd på utskickslistan.`,
        audience: "litteraturbanken"
      },
      signal: AbortSignal.timeout(30_000)
    })
    if (requestError) return showFailure()
  } catch {
    return showFailure()
  }

  showNewsletter.value = true
  hideSuccessAfterDelay()
}
</script>

<template>
  <AboutPageShell active-page="kontakt">
    <div class="page-contactForm">
      <div v-show="showForms">
        <div class="header">Vill du skicka ett meddelande till oss? Då kan du använda formuläret här nedan.</div>
        <form name="form" class="contactform" novalidate @submit.prevent="submitContactForm">
          <div class="form_head">
            <div>
              <label for="nameInput">Namn</label>
              <input
                id="nameInput"
                v-model.trim="name"
                type="text"
                autofocus
                :class="{ 'ng-dirty': nameDirty }"
                @input="nameDirty = true"
              >
            </div>
            <div>
              <label for="emailInput">Epost</label>
              <input
                id="emailInput"
                v-model.trim="email"
                name="uEmail"
                type="email"
                required
                :class="{ 'ng-dirty': emailDirty, 'ng-invalid': emailDirty && !emailValid }"
                @input="emailDirty = true"
              >
              <span class="error_msg">Skriv din epostadress</span>
            </div>
          </div>
          <div class="msg_box">
            <textarea
              v-model.trim="message"
              required
              :class="{ 'ng-dirty': messageDirty, 'ng-invalid': messageDirty && !messageValid }"
              @input="messageDirty = true"
            />
            <div class="error_msg">Meddelandet är tomt.</div>
            <div class="submit_container flex justify-end">
              <div v-show="isLoading" class="pt-1 pr-2 ng-fade"><i class="spinner fa fa-spinner fa-pulse" /></div>
              <button class="btn submit" :disabled="!contactDirty || !contactValid">Skicka</button>
              <div style="clear:both;" />
            </div>
          </div>
        </form>
        <div class="lowersection">
          <p>
            Vill du få Litteraturbankens utskick? Skriv in din epostadress här.
          </p>
          <form name="subscribeform" class="subscribeform flex pr-2" novalidate @submit.prevent="subscribe">
            <label class="pt-1" for="newsletterEmail">Epost</label>
            <input
              id="newsletterEmail"
              v-model.trim="newsletterEmail"
              class="mr-4 flex-grow"
              required
              type="email"
              :class="{ 'ng-dirty': newsletterDirty, 'ng-invalid': newsletterDirty && !newsletterValid }"
              @input="newsletterDirty = true"
            >
            <button class="btn submit" :disabled="!newsletterDirty || !newsletterValid">Skicka</button>
          </form>
        </div>
      </div>
      <div v-show="showContact">Tack för ditt meddelande, vi svarar så fort vi kan.</div>
      <div v-show="showNewsletter">Tack för din anmälan.</div>
      <div v-show="showError">Ett fel uppstod. Vänligen försök igen senare.</div>
    </div>
  </AboutPageShell>
</template>

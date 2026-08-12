<script setup lang="ts">
import { useId } from "vue"

defineProps<{
    filter: string
    hasActiveFilters: boolean
    advancedOpen: boolean
}>()

const searchInputId = `library-search-${useId()}`

const emit = defineEmits<{
    "update-filter": [value: string]
    submit: []
    reset: []
    "toggle-advanced": []
}>()

function inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value
}
</script>

<template>
    <form
        class="lg:p-5 p-2 lg:border border-gray-900 w-full lg:max-w-5xl"
        @submit.prevent="emit('submit')"
    >
        <div class="main_input flex flex-wrap -ml-6 relative mb-8 items-center">
            <label :for="searchInputId" class="sr-only">Sök i biblioteket</label>
            <svg
                class="w-6 h-6 relative left-10 top-0 -mt-px"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7A1400"
                stroke-width="1.5"
                aria-hidden="true"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
            </svg>
            <input
                :id="searchInputId"
                :value="filter"
                data-library-filter
                class="filter_input border border-gray-500 mr-4 flex-grow py-3 pl-12 pr-4 text-base"
                autofocus
                placeholder="Skriv författarnamn eller titel"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="none"
                spellcheck="false"
                @input="emit('update-filter', inputValue($event))"
            >
            <button type="submit" class="sr-only" tabindex="-1">Sök</button>
            <button
                v-show="hasActiveFilters"
                type="button"
                data-library-reset
                class="reset text-gray-700 transition duration-200 w-6 h-6 relative -left-14 top-0 -mr-8 cursor-pointer bg-transparent border-0 p-0"
                aria-label="Rensa sökning"
                @click="emit('reset')"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                    />
                </svg>
            </button>
            <button
                type="button"
                data-library-advanced
                :title="advancedOpen ? 'Enkel sökning' : 'Utökad sökning'"
                :aria-expanded="advancedOpen"
                aria-controls="library-advanced-panel"
                class="bg-white border border-gray-500 self-stretch px-4 focus:ring-1 focus:ring-inset focus:ring-primary"
                @click="emit('toggle-advanced')"
            >
                <span class="uppercase text-xs"
                    >{{ advancedOpen ? "Dölj" : "Visa" }} utökad sökning</span
                >{{ " " }}
                <svg
                    v-if="!advancedOpen"
                    data-library-filter-icon
                    class="filter w-6 h-6 relative top-1 inline-block text-gray-700"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke-width="1.5"
                    stroke="currentColor"
                    aria-hidden="true"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25"
                    />
                </svg>
                <svg
                    v-else
                    data-library-filter-icon
                    class="filter w-6 h-6 relative top-1 inline-block text-gray-700"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke-width="1.5"
                    stroke="currentColor"
                    aria-hidden="true"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12"
                    />
                </svg>
            </button>
        </div>
        <slot />
    </form>
</template>

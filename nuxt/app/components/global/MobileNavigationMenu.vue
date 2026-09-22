<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
// Load menu fonts after hydration so the font host cannot delay navigation.
const loadMenuFonts = ref(false)
useHead({
  link: computed(() => loadMenuFonts.value
    ? [{ rel: "stylesheet", type: "text/css", href: "https://cloud.typography.com/7426274/628748/css/fonts.css" }]
    : [])
})
onMounted(() => { loadMenuFonts.value = true })
</script>

<template>
  <div class="mobile-navigation-menu">
    <div class="menu-content">
      <TungstenMenu :open="open" @navigate="emit('navigate')" />
      <div class="menu-utility-links">
        <a href="/skolan/lararsida/">Lärare</a><a href="/bibliotekariesidor/">Bibliotekarier</a>
        <NuxtLink to="/om/english.html" no-prefetch>English</NuxtLink><NuxtLink to="/om/deutsch.html" no-prefetch>Deutsch</NuxtLink><NuxtLink to="/om/francais.html" no-prefetch>Français</NuxtLink>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
// Illustration and Tungsten weights restored from hamburger (ad600599),
// app/views/components/mobile_menu.html.
// Use installed faces while the development font service is unavailable.
@font-face { font-family: "Menu Tungsten Local"; src: local("Tungsten-Thin"); font-weight: 100; }
@font-face { font-family: "Menu Tungsten Local"; src: local("Tungsten-Light"); font-weight: 300; }
@font-face { font-family: "Menu Tungsten Local"; src: local("Tungsten-SemiBold"); font-weight: 600; }
.mobile-navigation-menu { display: none; }
@media (max-width: 1023px) {
  body #leftCorridor.site-navigation {
    &:has(.mobile-navigation-menu) {
      > .logo_link_monogram { width: 84px; height: 90px; margin: 0; }
      .lb-logo { width: 84px; height: 90px; }
      background: #ffda54;
      box-shadow: inset 0 0 26px #98662066;
      .site-menu-toggle { color: #453d1c; border-color: #867431; background: transparent; }
      > :is(a, button):focus-visible { outline-color: #453d1c; }
    }
    .desktop-navigation { display: none; }
    .site-navigation-panel {
      width: calc(100% + 32px);
      margin-right: -16px;
      margin-left: -16px;
    }
    .mobile-navigation-menu {
      --menu-paper: #fff;
      --menu-ink: #25231f;
      --menu-accent: #4f4637;
      --menu-line: #bab3a8;
      display: block;
      margin: 12px 0 -12px;
      padding: 0 0 24px;
      container-type: inline-size;
      color: var(--menu-ink);
      background: var(--menu-paper);
      text-align: left;
      font-family: "Requiem Text A", Georgia, serif;
      a { color: inherit; text-decoration: none; }
      a:hover { text-decoration: underline; }
      :is(a, button, input):focus-visible { outline: 2px solid var(--menu-accent); outline-offset: 3px; }
      ul { list-style: none; padding: 0; margin: 0; }
      li { margin: 0; padding: 0; }
      .menu-content { display: flex; flex-direction: column; gap: 2.5cqw; padding-top: 2.5cqw; }
      .menu-search-label { display: block; margin: 0 0 10px; font: 11px/1.5 Arial, sans-serif; letter-spacing: .13em; text-transform: uppercase; color: var(--menu-accent); }
      .menu-utility-links { display: flex; flex-wrap: wrap; gap: 0 16px; border-top: 1px solid var(--menu-line); padding-top: 8px; font: 12px Arial, sans-serif; a { display: flex; align-items: center; min-height: 44px; } }
      .menu-search-section { position: relative; z-index: 2; }
      .menu-search-body { position: relative; }
      .menu-quick-search input { width: 100%; min-width: 0; min-height: 48px; padding: 10px 12px; border: 1px solid var(--menu-line); border-radius: 0; background: var(--menu-paper); color: var(--menu-ink); font: 16px/1.4 Arial, sans-serif; box-sizing: border-box; }
      .menu-quick-search input::placeholder { color: var(--menu-placeholder, #767676); opacity: 1; font-family: "Requiem Text A", "Requiem Text B", Georgia, serif; font-size: 18px; }
      .menu-search-options { position: absolute; top: 100%; left: 0; right: 0; z-index: 1; width: 100%; max-width: none; max-height: 260px; overflow-y: auto; background: var(--menu-paper); border: 1px solid var(--menu-line); margin-top: 4px; }
      .menu-search-status { position: absolute; top: 100%; left: 0; right: 0; z-index: 1; margin: 4px 0 0; padding: 10px 12px; border: 1px solid var(--menu-line); background: var(--menu-paper); color: var(--menu-ink); }
      .menu-search-options li a { display: block; min-height: 44px; padding: 10px 12px; font-size: 18px; line-height: 1.3; overflow-wrap: anywhere; }
      .menu-search-options .type_label { display: block; font: 11px/1.4 Arial, sans-serif; }
      .menu-search-options .active { color: var(--menu-paper); background: var(--menu-ink); }
      .menu-search-section { padding: 4.8cqw 3.2cqw; background: linear-gradient(#0005, #0008), url("/assets/menu-tungsten/quick-search.jpg") left center / cover; }
      .menu-search-label { color: white; font: 300 8.5cqw/1 "Tungsten A", "Tungsten B", "Menu Tungsten Local", sans-serif; letter-spacing: .02em; }
      .menu-quick-search input, .menu-search-options { background: white; color: #25231f; }
      .menu-utility-links { margin: 0 8px; }

    }
  }
}
</style>

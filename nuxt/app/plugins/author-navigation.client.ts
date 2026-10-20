import { isNavigationFailure, NavigationFailureType } from "vue-router"

export default defineNuxtPlugin(nuxtApp => {
  const pendingStates = [
    useState<string | null>("author-navigation-pending", () => null),
    useState<string | null>("author-tab-pending", () => null)
  ]
  const router = useRouter()

  for (const pending of pendingStates) {
    router.beforeEach(to => {
      if (pending.value !== to.fullPath) pending.value = null
    })
    router.afterEach((to, _from, failure) => {
      if (failure && (pending.value === to.fullPath
        || isNavigationFailure(failure, NavigationFailureType.duplicated))) pending.value = null
    })
    router.onError((_error, to) => {
      if (pending.value === to.fullPath) pending.value = null
    })
    nuxtApp.hook("page:finish", () => {
      if (pending.value === router.currentRoute.value.fullPath) pending.value = null
    })
    nuxtApp.hook("app:error", () => { pending.value = null })
  }
})

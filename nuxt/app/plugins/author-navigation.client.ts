import { isNavigationFailure, NavigationFailureType } from "vue-router"

export default defineNuxtPlugin(nuxtApp => {
  const pending = useState<string | null>("author-navigation-pending", () => null)
  const router = useRouter()

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
})

<script lang="ts">
import { defineComponent, h } from "vue"

import type { RenderableHtmlProps } from "../../../shared/types/renderable-html"

export default defineComponent(
  (props: RenderableHtmlProps, { attrs }) => () => {
    const forwardedAttrs = Object.fromEntries(
      Object.entries(attrs).filter(([name]) => name !== "innerHTML" && name !== "textContent")
    )
    return h(props.as, {
      ...forwardedAttrs,
      innerHTML: props.html
    })
  },
  {
    inheritAttrs: false,
    props: {
      as: { type: null, required: true },
      html: { type: null, required: true }
    }
  }
)
</script>

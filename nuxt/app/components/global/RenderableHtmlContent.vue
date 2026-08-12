<script lang="ts">
import { defineComponent, h, type PropType } from "vue"

import {
  RENDERABLE_HTML_TAGS,
  type RenderableHtmlProps,
  type RenderableHtmlTag
} from "#shared/types/renderable-html"

const isRenderableHtmlTag = (value: unknown): value is RenderableHtmlTag =>
  typeof value === "string" && RENDERABLE_HTML_TAGS.some(tag => tag === value)

export default defineComponent(
  (props: RenderableHtmlProps, { attrs }) => () => {
    if (!isRenderableHtmlTag(props.as)) return null

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
      as: {
        type: String as PropType<RenderableHtmlTag>,
        required: true,
        validator: isRenderableHtmlTag
      },
      html: { type: null, required: true }
    }
  }
)
</script>

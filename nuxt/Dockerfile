FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS build

ARG NUXT_BUILD_ID

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
RUN yarn --version && yarn install --frozen-lockfile --non-interactive

COPY . .
RUN test -n "$NUXT_BUILD_ID" && NUXT_BUILD_ID="$NUXT_BUILD_ID" yarn build

FROM node:22.22.0-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS runtime

WORKDIR /app

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3020

COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/scripts/verify-public-resource.mjs ./scripts/verify-public-resource.mjs

USER node

EXPOSE 3020

CMD ["node", ".output/server/index.mjs"]

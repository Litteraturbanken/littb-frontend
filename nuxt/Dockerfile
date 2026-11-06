FROM node:22.23.4-bookworm-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d AS build

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
RUN yarn --version && yarn install --frozen-lockfile --non-interactive

COPY . .
ARG NUXT_BUILD_ID
RUN test -n "$NUXT_BUILD_ID" && NUXT_BUILD_ID="$NUXT_BUILD_ID" yarn build

FROM node:22.23.4-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202 AS runtime

WORKDIR /app

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3020

COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/scripts/verify-public-resource.mjs ./scripts/verify-public-resource.mjs

USER node

EXPOSE 3020

CMD ["node", ".output/server/index.mjs"]

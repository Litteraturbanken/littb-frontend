FROM node:22.22.0-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive

COPY . .
RUN yarn build

FROM node:22.22.0-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3020

COPY --from=build --chown=node:node /app/.output ./.output

USER node

EXPOSE 3020

CMD ["node", ".output/server/index.mjs"]

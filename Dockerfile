FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run postinstall && npm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app

COPY --from=build --chown=node:node /app/.output ./.output

USER node
EXPOSE 8080

CMD ["node", ".output/server/index.mjs"]

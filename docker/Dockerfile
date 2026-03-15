FROM node:22-bookworm-slim AS build
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json ./
COPY packages/server/package.json ./packages/server/package.json
COPY packages/web/package.json ./packages/web/package.json

RUN corepack enable \
  && corepack prepare yarn@4.13.0 --activate \
  && yarn install --immutable

COPY packages ./packages
COPY scripts ./scripts
COPY program.md ./program.md

RUN yarn workspace server build \
  && yarn workspace web build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SERVER_PORT=4000
ENV WEB_PORT=3000
ENV GRAPHQL_ENDPOINT=/graphql

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/program.md ./program.md
COPY docker/docker-entrypoint.sh ./docker/docker-entrypoint.sh

RUN chmod +x ./docker/docker-entrypoint.sh \
  && mkdir -p /app/obsidian-repository

EXPOSE 3000 4000

ENTRYPOINT ["./docker/docker-entrypoint.sh"]
CMD ["web"]

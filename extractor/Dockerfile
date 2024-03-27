FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
USER node
WORKDIR /usr/src/app

FROM base AS build
COPY --chown=node:node . /usr/src/app/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter ./extractor deploy /tmp/pruned

FROM base
COPY --from=build /tmp/pruned .
CMD ["pnpm", "start"]

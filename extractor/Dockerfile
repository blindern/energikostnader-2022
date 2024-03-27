FROM node:20-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY --chown=node:node package.json pnpm-lock.yaml /usr/src/app/

USER node
WORKDIR /usr/src/app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY --chown=node:node tsconfig.json /usr/src/app/
COPY --chown=node:node src /usr/src/app/src

CMD ["pnpm", "start"]

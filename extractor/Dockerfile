FROM node:19-slim

COPY --chown=node:node package.json package-lock.json /usr/src/app/

USER node
WORKDIR /usr/src/app

RUN npm ci

COPY --chown=node:node tsconfig.json /usr/src/app/
COPY --chown=node:node src /usr/src/app/src

CMD ["npx", "ts-node",  "/usr/src/app/src/service/service.ts"]

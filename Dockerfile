FROM node:22.10 AS build-env

COPY . /build
WORKDIR /build
RUN corepack enable
RUN yarn install --immutable
RUN yarn compile
RUN wget https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.2/napi-v6-linux-musl-x64.tar.gz && tar -xvzf napi-v6-linux-musl-x64.tar.gz
RUN mv ./napi-v6-linux-musl-x64 /build/node_modules/sqlite3/lib/binding

FROM node:22.10

COPY --from=build-env /build/prisma /app/prisma
COPY --from=build-env /build/dist /app
COPY --from=build-env /build/node_modules /app/node_modules
COPY package.json /app

WORKDIR /app
ENTRYPOINT ["/usr/local/bin/node", "index.js"]

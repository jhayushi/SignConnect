FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci

COPY client client
COPY server server
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/var/data/signconnect.sqlite

EXPOSE 3001

CMD ["node", "server/dist/index.js"]

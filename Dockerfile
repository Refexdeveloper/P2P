# Build client SPA, then run Express API (serves client/out in production).
FROM node:20-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

COPY server/ ./
# index.js resolves ../../client/out from server/src → /app/client/out
COPY --from=client-build /app/client/out /app/client/out

EXPOSE 8080
CMD ["node", "src/index.js"]

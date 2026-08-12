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

# Chrome for PO PDF (puppeteer-core). Cloud Run needs system Chrome + /tmp writable dirs.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV HOME=/tmp
ENV XDG_CONFIG_HOME=/tmp/.chromium
ENV XDG_CACHE_HOME=/tmp/.chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    fonts-noto-core \
    fonts-noto-color-emoji \
    gnupg \
    wget \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub \
    | gpg --dearmor -o /usr/share/keyrings/google-linux-signing-key.gpg \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux-signing-key.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
    > /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-chrome-stable \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /tmp/.chromium \
  && google-chrome-stable --version \
  && test -x /usr/bin/google-chrome-stable

COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

COPY server/ ./
# index.js resolves ../../client/out from server/src → /app/client/out
COPY --from=client-build /app/client/out /app/client/out

EXPOSE 8080
CMD ["node", "src/index.js"]

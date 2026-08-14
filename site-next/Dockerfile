FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run check

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

RUN useradd --system --uid 1001 axecloud
COPY --from=build --chown=axecloud:axecloud /app/dist/standalone ./dist/standalone
COPY --from=build --chown=axecloud:axecloud /app/server.mjs ./dist/standalone/server-wrapper.mjs

USER axecloud
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/standalone/server-wrapper.mjs"]

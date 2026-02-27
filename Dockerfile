# syntax=docker/dockerfile:1.7

FROM node:20-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5180
ENV DATA_DIR=/app/data

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY index.html ./index.html
COPY public ./public
COPY assets ./assets
COPY src ./src

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 5180

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5180)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server/index.mjs"]


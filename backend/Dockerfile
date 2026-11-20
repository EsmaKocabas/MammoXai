
# BUILD STAGE
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build


# PRODUCTION STAGE
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && \
    npm cache clean --force

COPY --from=builder /app/dist ./dist

# Upload klasörleri
RUN mkdir -p /app/uploads/mammograms /app/uploads/heatmaps && \
    chown -R node:node /app

USER node

EXPOSE 5001

CMD ["node", "dist/index.js"]

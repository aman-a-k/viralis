# Viralis web app (self-hosting alternative to Vercel).
# The supported production path is Vercel + the worker on Render — see
# README.md. This image is for running everything on your own server
# (docker compose up), e.g. for staging.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate && npx next build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
# Apply pending migrations, then serve.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 3000"]

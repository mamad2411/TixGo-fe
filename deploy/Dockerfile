# TixGo frontend — build statis + nginx (docs/13 §3). Konteks build = folder frontend.
FROM node:26-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@12.3.4
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Variabel VITE_* tertanam saat build (publik; tanpa secret).
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_WS_URL
ARG VITE_MIDTRANS_ENV=sandbox
ARG VITE_DEFAULT_LOCALE=id
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_WS_URL=$VITE_WS_URL VITE_MIDTRANS_ENV=$VITE_MIDTRANS_ENV VITE_DEFAULT_LOCALE=$VITE_DEFAULT_LOCALE
RUN pnpm build

FROM nginx:1.27-alpine
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# DNS_RESOLVER default = DNS internal Docker; ganti di Kubernetes/host lain.
ENV API_UPSTREAM=http://api:8081 DNS_RESOLVER=127.0.0.11
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s CMD ["wget", "-qO-", "http://127.0.0.1/healthz"]

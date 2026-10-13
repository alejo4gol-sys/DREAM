FROM node:22-slim AS build
WORKDIR /app
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install --workspace apps/web --include-workspace-root=false --no-audit --no-fund
COPY apps/web apps/web
RUN npm run build --workspace apps/web

FROM node:22-slim
WORKDIR /app
ARG API_INTERNAL_URL=http://api:4000
# También en ejecución: la página web pública arma su vista previa para redes (título, foto) desde el servidor.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 API_INTERNAL_URL=$API_INTERNAL_URL
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

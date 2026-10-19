# Snowline web app: Next.js standalone server plus the pipeline's per-resort app.json files.
# Red Hat UBI images so it builds and runs cleanly on OpenShift (arbitrary UID, no Docker Hub pulls).

FROM registry.access.redhat.com/ubi9/nodejs-22 AS build
USER 0
WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/pipeline/package.json packages/pipeline/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund
COPY . .
# Unit tests (solar, incidence, scoring scenarios, terrain) gate the image.
RUN npm test
RUN npm run build
# Ship only what the app reads at runtime from the pipeline output.
RUN mkdir -p /out/data && for f in data/*/app.json; do d=$(dirname "$f"); mkdir -p "/out/$d" && cp "$f" "/out/$d/"; done

FROM registry.access.redhat.com/ubi9/nodejs-22-minimal
USER 0
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    SNOWLINE_DATA_DIR=/app/data
COPY --from=build /src/apps/web/.next/standalone ./
COPY --from=build /src/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /src/apps/web/public ./apps/web/public
COPY --from=build /out/data ./data
# OpenShift runs as a random UID in group 0.
RUN chgrp -R 0 /app && chmod -R g=u /app
USER 1001
EXPOSE 8080
CMD ["node", "apps/web/server.js"]

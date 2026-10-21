#!/usr/bin/env bash
# Build Snowline in the cluster from the local working tree and roll it out.
# Usage: scripts/deploy-openshift.sh [namespace]    (default: the current oc project)
# Afterwards the built image is copied to $QUAY_REPO (default quay.io/cmalafis10/snowline) as :<git sha> and
# :latest, for running elsewhere (e.g. AWS). Needs `podman login quay.io`; set QUAY_REPO= to skip.
set -euo pipefail
cd "$(dirname "$0")/.."

NS="${1:-$(oc project -q)}"
echo "Deploying to project: $NS ($(oc whoami --show-server))"

# The app ships each resort's pipeline output; make sure it's current.
for cfg in config/resorts/*.json; do
  id=$(basename "$cfg" .json)
  [[ -f "data/$id/app.json" ]] || { echo "data/$id/app.json missing: run 'npm run pipeline -- $id' first" >&2; exit 1; }
done

oc apply -n "$NS" -f deploy/openshift/build.yaml
oc apply -n "$NS" -f deploy/openshift/app.yaml
# Point the deployment at the image stream so the image trigger can resolve it.
oc set image-lookup -n "$NS" deploy/snowline >/dev/null

# Upload only what the Dockerfile needs (mirrors .dockerignore; node_modules and the DEM stay local).
# Stage a clean copy and let oc pack it: macOS tar adds extended-attribute headers the builder can't extract.
STAGE=$(mktemp -d -t snowline-src)
trap 'rm -rf "$STAGE"' EXIT
rsync -a \
  --exclude .git --exclude node_modules --exclude .next --exclude test-results --exclude playwright-report \
  --exclude 'apps/web/public/maplibre' --exclude 'data/*/dem.tif' --exclude 'data/*/canopy.tif' --exclude 'data/*/osm.json' --exclude 'data/*/cache' \
  --exclude 'reference/trailmaps' --exclude .DS_Store --exclude '.env*' \
  ./ "$STAGE/"
echo "Uploading $(du -sh "$STAGE" | cut -f1) of source"
oc start-build -n "$NS" snowline --from-dir="$STAGE" --follow --wait

oc rollout status -n "$NS" deploy/snowline --timeout=5m
echo "Snowline is live at: https://$(oc get route -n "$NS" snowline -o jsonpath='{.spec.host}')"

QUAY_REPO="${QUAY_REPO-quay.io/cmalafis10/snowline}"
if [[ -n "$QUAY_REPO" ]] && podman login --get-login "${QUAY_REPO%%/*}" >/dev/null 2>&1; then
  REG=$(oc registry info --public 2>/dev/null)
  DIGEST=$(oc get istag -n "$NS" snowline:latest -o jsonpath='{.image.metadata.name}')
  TAG=$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- . || echo -dirty)
  podman login -u "$(oc whoami)" -p "$(oc whoami -t)" "$REG" >/dev/null
  podman pull -q --platform linux/amd64 "$REG/$NS/snowline@$DIGEST" >/dev/null
  podman tag "$REG/$NS/snowline@$DIGEST" "$QUAY_REPO:$TAG" "$QUAY_REPO:latest"
  podman push -q "$QUAY_REPO:$TAG" && podman push -q "$QUAY_REPO:latest"
  echo "Pushed $QUAY_REPO:$TAG and :latest"
elif [[ -n "$QUAY_REPO" ]]; then
  echo "Not logged in to ${QUAY_REPO%%/*}; skipped the image push (podman login ${QUAY_REPO%%/*})"
fi

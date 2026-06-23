# =============================================================================
# RedStars MyApp service — multi-stage build, scratch runtime (0 CVE).
# Build context: a dir containing  backend/  (core repo's apps/backend)
# and  studio/  (this repo) — see .github/workflows/deploy-dev.yml.
# =============================================================================

FROM golang:1.26-alpine AS builder
WORKDIR /build
RUN apk add --no-cache git ca-certificates tzdata

# go.mod first — layer cache.
COPY backend/go.mod backend/go.sum ./backend/
COPY studio/go.mod ./studio/
RUN cd studio && go mod download || true

COPY backend/ ./backend/
COPY studio/ ./studio/

RUN cd studio && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" -o /build/bin/studio ./cmd/studio

# --- Runtime ----------------------------------------------------------------
FROM scratch
LABEL org.opencontainers.image.title="RedStars MyApp Service"

COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /build/bin/studio /studio
COPY --from=builder /build/backend/locales /locales

EXPOSE 3020
USER 1000:1000
ENTRYPOINT ["/studio"]

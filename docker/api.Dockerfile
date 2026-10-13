FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS frontend-build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY frontend ./frontend
COPY vite.config.ts tsconfig.frontend.json eslint.config.js ./
RUN npm run build

FROM rust:1.99-bookworm AS api-build

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY db ./db
RUN cargo build --release --locked

FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends --yes ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid 10001 --no-create-home app

COPY --from=api-build --chown=app:app /app/target/release/dkb-dashboard-api /usr/local/bin/dkb-dashboard-api
COPY --from=frontend-build --chown=app:app /app/frontend/dist ./frontend/dist

ENV FRONTEND_DIR=/app/frontend/dist \
    RUST_LOG=dkb_dashboard_api=info,tower_http=info

USER app

ENTRYPOINT ["/usr/local/bin/dkb-dashboard-api"]

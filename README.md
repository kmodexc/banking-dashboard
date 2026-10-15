# Personal Finance Dashboard

A client-side React and TypeScript browser application for importing, categorizing, and analyzing bank transaction exports. The browser owns transaction data; the Rust API handles authenticated Gemini classification and configurable rule synchronization. The parser supports DKB's semicolon-separated CSV format and Deutsche Bank credit-card CSV exports, and additional bank formats can be added without changing the dashboard.

The app uses a configured Keycloak realm for access control. Gemini credentials are only configured on the API server and are never sent to the browser.

## Features

- **Browser dashboard:** Parses supported bank CSV files locally and provides:
  - **Financial Dashboard:** Monthly breakdown of income, expenses, and net balance with an interactive category chart.
  - **Categorize Unknown:** An interactive UI to label unrecognized transactions and update local rules.
  - **AI Auto-Categorization:** Uses Google Gemini to automatically propose and apply categorization rules based on transaction context.
  - **Categories:** Manage user-specific category changes and choose whether rules stay local, sync privately, or contribute eligible global-category rules to the community.
- **Local rules:** The public build starts with no merchant-specific default rules; rules remain local before sign-in and are automatically synchronized to the enabled destinations after sign-in.
- **Shared rules:** Authenticated users default to storing their own rules privately, using community rules, and contributing rules that use only global categories. These options can be disabled. Custom-category rules are never shared with the community.
- **AI categorization:** Sends only selected unknown transactions to the authenticated API.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- A Keycloak realm and public client configured for the application origin
- Rust 1.99+ and Cargo for local API development
- [Google Gemini API Key](https://aistudio.google.com/app/apikey) on the server (optional until AI classification is used)

## Quick Start

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Configuration:**
   Copy `.env.example` to `.env`, set a strong `POSTGRES_PASSWORD`, and set your `GEMINI_API_KEY` (if using AI categorization). Keep `DATABASE_URL` consistent with the PostgreSQL credentials.

   ```bash
   cp .env.example .env
   ```

   Docker Compose binds to `127.0.0.1` by default. Set `APP_PORT` in `.env` to choose the host port (default: `8080`). If you change it, update `ALLOWED_ORIGINS` to match your dashboard URL, for example `http://localhost:9090` for `APP_PORT=9090`.

3. **Configure Keycloak:**
   Create a public client and set its valid redirect URI and web origin to the dashboard URL. Copy the realm issuer URL and client ID into `.env`. Set `KEYCLOAK_AUDIENCE` to a dedicated API audience when one is configured in the realm.

4. **Start the application using Docker Compose:**

   ```bash
   docker-compose up -d --build
   ```

5. **Access the Dashboard:**
   Open your browser and navigate to `http://localhost:8080` (or the port configured with `APP_PORT`), sign in, and choose a supported DKB or Deutsche Bank CSV export.

## Deploy behind Apache2

Compose publishes the app on localhost so a reverse proxy on the same server can provide HTTPS. Follow the [Apache2 deployment guide](docs/apache2.md) for a ready-to-copy virtual host, `.env` configuration, Keycloak settings, and verification commands. The guide serves the dashboard and API together at a dedicated domain such as `https://dashboard.example.com/`.

## Project Structure

- `src/main.rs`: Rust API entrypoint.
- `src/app.rs`: HTTP routes, middleware, and static frontend server.
- `src/auth.rs`: Keycloak JWT/JWKS validation.
- `src/rules.rs`: SQLx-backed transactional rule storage and legacy import.
- `src/classifier.rs`: Gemini REST integration with response validation.
- `db/rust-migrations/`: SQLx migrations used by the Rust service.
- `frontend/`: Vite, React, TypeScript, CSS, and bundled categorization rules.
- `docker-compose.yml`: Runs the static frontend and classification API.
- `tests/`: Playwright browser tests; Rust unit tests live with the API modules.
- `frontend/src/`: Typed UI, authentication, CSV parsing, rules, API validation, and unit/component tests.
- `.env.example`: Template for Keycloak and server-side Gemini configuration.
- `docker/api.Dockerfile`: Production image for the Rust API and static frontend.

## Manual Execution (Without Docker Compose)

For local development without Compose:

```bash
npm install
npm run build
export KEYCLOAK_ISSUER=https://auth.example.com/realms/example
export KEYCLOAK_CLIENT_ID=dkb-dashboard
export ALLOWED_ORIGINS=http://localhost:8080
export DATABASE_URL='postgres://dkb_dashboard:password@localhost:5432/dkb_dashboard'
export GEMINI_API_KEY='<server-side-key>'
cargo run --release
```

The browser keeps access and refresh tokens in this app origin's `sessionStorage`, so an accidental reload preserves the session while closing the tab clears it. The API validates the bearer token against the configured Keycloak issuer before calling Gemini. Use a dedicated origin for the dashboard; same-origin scripts can access browser storage.

The API performs authorization independently of browser state. It verifies the token signature through Keycloak's JWKS, issuer, expiry, issued-at time, subject, authorized party, and configured audience before allowing classification or rule synchronization. Configure `ALLOWED_ORIGINS` and `ALLOWED_HOSTS` with exact production values; wildcard values are rejected. The Compose service runs as a non-root user with a read-only filesystem and no added capabilities.

For the production-bundle browser smoke test, run `npm run test:e2e:production`. It builds the frontend, starts disposable PostgreSQL, serves the built bundle through the Rust API, and uses a local signed OIDC stub. The test does not intercept application API requests; it removes the local rule after saving and verifies that the authenticated rule is restored from PostgreSQL after reload.

For the container deployment smoke test, run `npm run test:deployment`. It builds the exact API image, runs it with PostgreSQL and a local OIDC service under the production-style non-root/read-only settings, checks health, headers, host validation, authenticated persistence, and restart recovery.

At startup, the Rust service runs the checked-in SQLx migrations against PostgreSQL before serving requests. Existing rule tables are compatible with the previous store, and a mounted legacy `dkb-rules.json` is imported once when `LEGACY_RULE_STORE_PATH` points to it. Rule replacements and community changes execute inside database transactions.

Transaction CSV files remain in the browser. When AI classification is requested, the browser sends selected recipient and purpose fields to the authenticated API, and the API forwards that selected data to Gemini. The API does not persist transaction data.

Run Rust checks with:

```bash
cargo fmt --all -- --check
cargo check --locked
cargo build --locked
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
```

Run browser component tests with:

```bash
npm install
npx playwright install chromium
npm run test:components
```

Run the PostgreSQL-backed store integration suite with Docker Compose:

```bash
npm run test:integration
npm run test:deployment
```

Run the frontend checks with:

```bash
npm run check:types
npm run lint
npm run format:check
npm run build
npm run test:unit
```

Run the complete locally available application suite, including the Rust build, with:

```bash
npm run test:all
```

## Managing Categories

Categorization rules are applied in the browser. Before sign-in, rules are local-only. New signed-in users default to private storage, community-rule consumption, and community sharing; each option can be disabled. The API stores private rules under that user's Keycloak subject. PostgreSQL accepts only rules using the bundled global categories for community sharing and stores deduplicated rules without transaction data. Local rules that existed before sign-in are synchronized automatically after login when server options are enabled. Private replacement and community changes are committed atomically, with database constraints protecting rule shape, category references, and duplicate keys. Users can delete their private server copy and remove their own community contributions from the Categories page.

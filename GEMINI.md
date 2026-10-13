# Personal Finance Dashboard Context

## Architecture

- `frontend/` is a browser-only React and TypeScript application. It parses supported bank CSV files, currently the DKB semicolon-separated format, applies categorization rules, calculates totals, and renders the dashboard.
- `src/` contains the Rust API, which serves the frontend, validates Keycloak bearer tokens, and calls Gemini for classification suggestions.
- Gemini credentials must remain server-side. Do not add them to frontend JavaScript or `config.js`.
- PostgreSQL stores opt-in rules through the Rust SQLx migration set in `db/rust-migrations/`. The old transaction/view SQL in `db/migrations/` remains reference material only.

## Authentication

- `KEYCLOAK_ISSUER` must be the full URL of the configured Keycloak realm.
- `KEYCLOAK_CLIENT_ID` is a public browser client. No client secret belongs in this repository.
- The browser uses Authorization Code + PKCE and keeps access and refresh tokens in memory.
- The API validates issuer, signature, expiry, and authorized party/audience before classification.

## Classification

- `/api/classify` accepts a bounded list of recipient/purpose pairs and returns validated category rules.
- The API must not persist transaction data or log raw transaction contents.
- The browser applies returned rules locally and stores user rules in local storage.
- `frontend/public/default-rules.json` is generated from the previous categorization SQL and is shipped as static data.
- Frontend data crossing runtime boundaries must be validated with Zod schemas.

## Local development

```bash
cargo run
```

Configure the Keycloak realm issuer, public client ID, allowed origin, and server-only Gemini key before testing sign-in or AI classification.

Run `cargo fmt --all -- --check`, `cargo check --locked`, and `cargo clippy --locked --all-targets -- -D warnings` for Rust validation.
Run `npm run check:types`, `npm run lint`, `npm run format:check`, and `npm run test:unit` for frontend validation.

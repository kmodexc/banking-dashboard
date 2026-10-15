Integration coverage implementation plan

Status: living implementation plan and coverage record. Phases 1–6 are implemented and executed; Phase 7 has a container smoke path and readiness checks, while real Keycloak and Apache/TLS validation remain explicitly deferred. Phase 8 maintenance is tracked in `docs/integration-coverage.csv`.

The objective is to exercise every supported external boundary and every critical user workflow, including failures, concurrency, persistence, recovery, and deployment configuration. Exhaustive testing of every possible input or execution interleaving is impossible. Completion means all scenarios in a maintained coverage inventory have passing executable tests, assigned CI jobs, and explicit assertions. A percentage or a large test count alone does not establish this.

1. Current coverage and concrete gaps

The frontend has Vitest component/data tests, including the recent CSV and visible-error regressions. The existing three Playwright tests cover import, local categorization, and a mocked classification flow. They run against Vite, intercept configuration and identity-provider requests, and replace the classification API. They do not establish that the Rust service can authenticate users, save rules, or serve a working production bundle.

The Rust workflow runs compilation, tests, formatting, and Clippy, but provisions no PostgreSQL service. The new RuleStore regression uses `#[ignore]`, so ordinary `cargo test --locked` does not execute it. SQL passed to `sqlx::query()` remains runtime-validated. Authentication and the classification provider make HTTP requests without corresponding integration suites. The Docker image and Apache configuration are not exercised by the current workflow.

The known incidents become mandatory regression cases:

| ID | Incident | Required evidence |
| --- | --- | --- |
| REG-01 | Private-rule insert fails due to missing conflict target | Real PostgreSQL insert, duplicate upsert, authenticated HTTP save, and browser save/reload all succeed |
| REG-02 | DKB `-1.480` rejected or interpreted as `-1.48` | Anonymized 12-column fixture imports as -1480; date, recipient, purpose, totals, and stored session agree |
| REG-03 | Empty amounts become zero income | Both banks reject missing billed amounts with source line; previous imported data remains intact |
| REG-04 | Foreign amount substituted for billed EUR amount | Correct EUR value used; absent conversion/billed amount produces an error |
| REG-05 | Delimiter and decimal commas confused | Quoted comma, semicolon, and tab exports produce equivalent transactions; malformed rows fail visibly |
| REG-06 | Setup notice hides import error | Both messages remain visible, accessible, and correctly formatted in the production browser |

2. Test architecture and ownership

Use six complementary suites. Keep every assertion at the cheapest layer that actually exercises the relevant integration, and repeat only critical workflows across layers.

| Suite | Real components | Controlled dependencies | Primary purpose |
| --- | --- | --- | --- |
| Store integration | RuleStore, SQLx, migrations, PostgreSQL 16 | Temporary legacy-import files | SQL correctness, constraints, transactions, concurrency |
| HTTP integration | Axum router, extractors, middleware, auth verifier, store, PostgreSQL | Local OIDC/JWKS and provider HTTP servers | Endpoint contracts, authentication, validation, side effects |
| Frontend integration | React, API client, schemas, browser storage | Explicit HTTP responses and controlled timing | UI failures, state transitions, races, schema compatibility |
| Application E2E | Production bundle, Rust HTTP server, PostgreSQL | Local signed-token OIDC server and provider server | Complete browser-to-database and browser-to-provider flows |
| Identity E2E | Application plus a real isolated Keycloak realm | Provider server | PKCE, login, refresh, logout, realm/client integration |
| Deployment integration | Built Docker image, Compose settings, PostgreSQL, Apache/TLS where applicable | Test identity/provider services | Packaging, routing, headers, startup, restart, persistence |

The local OIDC server must issue correctly signed RS256 tokens and serve matching discovery/JWKS responses. Never bypass AuthUser or inject an authenticated identity in a suite claiming to test authentication. Never mock RuleStore in a suite claiming persistence coverage. Browser tests with intercepted `/api/**` responses stay explicitly labeled frontend tests.

Proposed files:

- `src/lib.rs`: expose the application construction required by integration tests; keep executable startup in `src/main.rs`.
- `tests/support/`: database provisioning, AppState builder, signed tokens, stub HTTP services, failure controls, readiness and cleanup.
- `tests/store_integration.rs`, `tests/api_integration.rs`, `tests/auth_integration.rs`, `tests/provider_integration.rs`.
- `tests/fixtures/csv/`: anonymized bank files, expected transactions, expected errors, and fixture metadata.
- `tests/fixtures/contracts/`: JSON request/response fixtures consumed by Rust and TypeScript.
- `tests/fixtures/legacy-rules/`: supported historical JSON and malformed variants.
- `tests/e2e/`: production-browser workflows; preserve existing frontend browser tests separately.
- `tests/deployment/`: image, restart, proxy, and runtime configuration probes.
- `compose.test.yml`: isolated test stack with test-only credentials and disposable volumes.
- `playwright.e2e.config.js`: production URL, isolated browser contexts, failure artifacts.
- `docs/integration-coverage.csv`: scenario ID, owning test, boundary, CI job, priority, status, and unresolved policy.

Avoid introducing test-only authentication shortcuts into production. Introduce narrow constructor/configuration seams for provider endpoint, request timeout, and clock access. Production defaults remain unchanged. Configure stub URLs internally, never from a client request. Do not replace real outbound HTTP calls with fake return values in HTTP/provider suites.

3. Database and migration coverage — first priority

Run PostgreSQL 16, matching the current deployment major version. Create a fresh isolated database per test or test group. Apply actual `db/rust-migrations`, never a hand-written approximation. Do not use SQLite or an in-memory map as SQL validation.

Private-rule scenarios:

- Insert one valid rule and read it back with all fields and confidence preserved.
- Replace an existing collection, including replacing it with an empty collection.
- Case-insensitive keyword/category duplicates update confidence without duplicate rows.
- Identical keywords with different matching columns or categories remain distinct according to the real index.
- Same rule for two subjects remains isolated; replacing/deleting one subject cannot affect the other.
- Unicode keywords/categories, apostrophes, and SQL-looking text remain ordinary parameterized values.
- Null confidence and boundary confidence values round-trip; invalid confidence is rejected.
- Invalid keyword, category, column, and length limits are enforced by the appropriate validation layer.
- Force failure after DELETE and after one successful INSERT: the original collection survives the rollback.
- Concurrent replacements for the same subject finish with one complete collection, never a mixture; do not assume which request wins without an explicit ordering mechanism.
- Concurrent replacements for different subjects remain independent.
- Cancellation, pool exhaustion, connection loss, and recovery produce bounded failures with no partial commit.

Community-rule scenarios:

- Valid contribution creates a rule and contributor relationship.
- Same contributor submitting twice remains idempotent.
- Two contributors can share one case-insensitive rule.
- Removing one contributor preserves the other contribution; removing the last removes the orphaned rule.
- A user's removal cannot remove unrelated contributions or private rules.
- Unsupported/custom community categories fail without partial writes.
- Concurrent add/add and add/remove preserve referential integrity and the agreed final-state rules.
- A failed multi-rule contribution rolls back the entire transaction.

Schema/startup scenarios:

- Empty database migrates and seeds global categories.
- Repeated startup leaves schema and seed data stable.
- Two simultaneous startup processes handle migration locking correctly.
- Upgrade a database constructed from the previous released migration set, with representative rows, to the current set.
- Changed historical migration checksums fail clearly; migrations should be extended rather than edited after release.
- Permissions failures and unavailable database prevent false readiness/startup success.
- After restart, committed rules remain available.

Legacy JSON scenarios:

- No configured path and missing file are harmless.
- Supported private/community data imports with attribution and deduplication.
- Invalid records follow the explicitly documented skip policy; malformed top-level JSON reports a clear startup failure.
- Import completion marker prevents reimport on restart.
- Mid-import failure rolls back data and completion marker together.
- Concurrent startup cannot double-import or leave half-complete data.

Every SQL write path in `src/rules.rs` must execute against PostgreSQL in CI. Remove reliance on the currently ignored regression: move it into an explicitly selected required integration target that fails when its database is unavailable.

4. Endpoint and JSON contract coverage

Build the actual router and issue real HTTP requests for transport-sensitive scenarios. Router-level requests are sufficient for most handler cases, but cannot substitute for TCP tests of streaming body limits or connection interruption.

| Endpoint | Required successful integration | Required negative/side-effect checks |
| --- | --- | --- |
| `GET /healthz` | Expected status/body through runtime server | Define liveness vs readiness; do not treat current unconditional OK as database readiness |
| `GET /config.js` | Executable public config, correct MIME type, no-store | Escaping, empty optional config, no database credentials/API keys/token secrets |
| `GET /api/rules` | Authenticated user's private rules | Missing/invalid token; no other user's rows; malformed query |
| `GET /api/rules?include_community=true` | Private and community collections | False/default query excludes community; invalid values follow defined contract |
| `PUT /api/rules` | Save followed by independent GET and SQL verification | Invalid collection, duplicate policy, empty replacement, database failure and rollback |
| `DELETE /api/rules` | User's private rules removed | Repetition, wrong user, database failure |
| `POST /api/community/rules` | Contribution and ownership persisted | Custom category, invalid rule, duplicate submission, transaction failure |
| `DELETE /api/community/rules` | Contributor removal with shared rules preserved | Idempotency, user isolation, transaction failure |
| `POST /api/classify` | Valid request reaches controlled provider; validated rules returned | Input bounds, auth, rate/body limits, upstream faults, invalid upstream data |
| Static assets / SPA routes | Actual build loads and navigates | Missing assets, unknown API paths, MIME types, fallback rules |

For every protected endpoint: valid token, missing header, malformed token, expired token, wrong issuer/client, and another user's token where ownership matters. For every write: assert database state before and after success AND failure.

Capture status, content type, JSON envelope, and relevant headers. Current domain validation returns 422; auth returns 401, provider faults 502, unavailable configuration 503, rate limit 429, and database failure 500. Axum JSON/query extractor failures must also be inventoried rather than assumed to use the same envelope. Decide any desired contract normalization explicitly before changing tests.

Shared Rust/TypeScript fixtures must cover `column`/`rule_column` serialization, null/optional confidence, categories, unknown fields, missing fields, and maximum sizes. Test response bodies generated by Rust against the frontend schemas. Specify whether PUT returns submitted or canonical deduplicated rules; compare its response with a subsequent GET to expose disagreement.

5. Authentication and session coverage

Backend signed-token cases: valid RS256; missing/unknown kid; malformed signature; wrong key; unsupported algorithm; expired token; future not-before; missing required claims; wrong issuer; absent/wrong authorized party; configured audience match/mismatch; empty subject; and configured clock-skew boundaries. Treat future-issued-at policy as an explicit contract decision rather than assuming it is enforced.

Discovery/JWKS cases: cold cache, warm cache without extra fetch, cache expiry, rotated key, unknown key refresh, malformed JSON/key material, issuer mismatch, disallowed JWKS origin, provider 500, timeout, and concurrent first requests. Verify URL policy including scheme, host, port, and redirects against the documented trust model. Inject a clock for deterministic expiry tests rather than waiting five minutes.

Browser session cases: login redirect, PKCE S256 challenge/verifier relationship, correct state round-trip, missing/mismatched state, rejected/replayed code, callback cleanup, malformed token response, refresh success, rotated refresh token, refresh failure, simultaneous API actions near expiry, and logout with/without an end-session endpoint. Access/refresh tokens are kept in this app origin's `sessionStorage` to survive reloads and are removed on logout; same-origin scripts must therefore be treated as trusted. Temporary PKCE state is allowed only for the flow and is cleaned up.

Run a smaller real-Keycloak suite for login, authenticated save, refresh, logout, and user switching. Use a dedicated realm and two users. The browser and API must resolve the same public issuer URL; use local TLS/trusted test CA for container hostnames if required by production URL validation. Never weaken issuer validation simply to simplify tests.

Verify that a slow response from user A cannot become visible after switching to user B. Distinguish intentionally browser-local rules from user-scoped server rules and preferences; document expected cross-login behavior for local data before asserting it.

6. Classification provider coverage

Allow the provider HTTP endpoint and timeout to be supplied by the application test constructor. The HTTP stub must inspect actual requests and return realistic Gemini envelopes.

Outbound assertions: exact HTTP method/path/model, credential handling, selected transactions only, category set, threshold/bounds, and absence of amount/date/account fields added outside the permitted contract. Recipient/purpose themselves can contain sensitive text; tests must not imply those fields are automatically anonymized.

Inbound matrix: valid envelope; empty candidates; missing content/parts/text; non-JSON text; non-array rules; malformed rule; invalid category/column/confidence; low confidence; too many results; duplicate rules; Unicode; oversized response; and partial valid results. Specify the intended filter-vs-error policy and check that UI matches it.

Failure matrix: 400/401/403/429/500 from provider, slow response, dropped connection, invalid JSON, missing API key, and recovery on the next request. Assert safe 502/503 behavior, bounded duration, and no database mutation.

Test rate limiting per subject, independence between users, expiry of the limit window, concurrent requests at the boundary, and Retry-After. Invalid/unauthorized requests must have the documented effect on rate-limit counters and must not invoke the provider.

Do not use live Gemini calls in required CI. An optional manual provider smoke test can use synthetic input and a separate credential/budget; it checks provider compatibility, not deterministic classification quality.

7. CSV import and financial-result coverage

Keep raw anonymized exports as files, not only hand-assembled arrays. Each fixture declares bank/export version, encoding, separator, number convention, header layout, expected records, and expected totals in integer cents. Expected outputs must be hand-reviewed and independent of parser code.

Cover DKB legacy/current layouts and Deutsche Bank credit-card exports. For each supported layout exercise: metadata before header, BOM, LF/CRLF/CR, quoted/unquoted fields, escaped quotes, embedded delimiter, multiline purpose, blank lines, trailing empty columns, missing/extra columns, repeated headers, empty file, header-only file, summary/footer rows, and malformed quotes. Unsupported encodings/formats must be rejected clearly rather than silently corrupting names or amounts.

Numeric matrix: German and English grouped decimals; integer amounts; one/two decimal places; whole-euro grouping including `-1.480`; large multi-group numbers; zero; positive/negative signs; whitespace; currency suffixes; empty values; inconsistent grouping; excess precision; exponent/hex/non-finite values; unsafe magnitude; and wrong currency. Bank format supplies locale context when known; absent context, ambiguity produces a visible error. Include foreign original amount, exchange rate, and distinct billed EUR amount.

Date matrix: supported short/full years, slash/dot/compact dates, leap day, invalid calendar date, month/year boundary, and differences between transaction and posting dates. Explicitly document which bank date drives the dashboard period. Assert no timezone-induced date shift.

For a successful import assert full normalized transactions, transaction count, monthly expenses/income/net totals, category totals, display formatting, and restored-session values. For a failure assert visible source line number and original record, including multiline/blank-line accounting; no partial import; prior valid data preserved; and successful corrected retry. Test selecting the same filename again after failure.

Add generated/property tests with a reproducible seed for quoting/delimiter/number combinations and round-trips. They complement real fixtures rather than replacing them. Keep minimal reproductions for every generated failure.

8. Frontend state, storage, rule-sync, and privacy coverage

Exercise the actual API client and React hook together for rule preferences and synchronization. Include all supported combinations of private storage, community contribution, and community consumption, authenticated and unauthenticated. Assert exactly which requests happen; opting out must produce no automatic upload.

Scenarios: local rule create/edit/delete; rule matching in recipient/purpose/both; case-insensitive deduplication; precedence among local/private/community/default rules; custom category stays private; server rules load on opt-in; deletion; toggling settings during requests; repeated clicks; local edit during pending sync; out-of-order saves; logout/user switch during pending reads/writes; private-save success with community-save failure; offline failure and retry. Define last-edit ordering and recovery semantics explicitly, then test them.

Storage scenarios: reload, separate tab/context, malformed saved JSON, obsolete schema, missing fields, denied/quota-exhausted storage, and persistence failure. No silent user-data loss. Clarify sessionStorage's tab-scoped behavior separately from persistent localStorage behavior. Assert overrides/categories/preferences are scoped as intended.

Visible failure matrix: 401, 422, 429, 500, 502, 503, invalid JSON, schema mismatch, network disconnect, and timeout. Errors must be accessible, distinguish failure from success, preserve usable local state, and support a defined retry path. Setup messages cannot obscure action errors.

Privacy checks inspect network traffic, provider requests, PostgreSQL contents, and captured logs using synthetic marker values. Importing a CSV must not send it to a server. Only opted-in rules are stored. Classification sends only the permitted selected fields. No bearer tokens, API keys, credentials, or full CSV records appear in server logs or CI artifacts. Include upstream HTTP errors because request URLs may carry provider credentials.

9. Production-browser journeys

Run these against the built frontend served by Rust and a real test database. Use actual authentication HTTP flow and signed tokens; do not intercept application API requests.

- Import each bank, inspect totals and details, change period/category, reload, and verify restoration.
- Import a broken file, see exact line error, retain old data, then correct and retry.
- Create a local rule offline and confirm no network upload.
- Sign in, opt into private storage, create/edit/delete rules, inspect SQL state, reload in a fresh authenticated browser context, and verify server persistence.
- Two users save identical rules without seeing one another's private data.
- Two users contribute a shared rule; removing one contribution preserves it; removing the last removes it.
- Create a custom category and verify it is never submitted as a community category.
- Request classification, inspect permitted provider payload, accept valid suggestions, and see resulting categorization.
- Force provider/database outage, see a useful error, recover, retry, and verify no duplication or data loss.
- Session refresh/expiry/logout and user switch while work is pending.
- Rapid edits and repeated action clicks produce the defined final server state.

Use Chromium for the required full journey suite; run a smaller critical-flow suite in Firefox/WebKit on schedule and before release. Assert no unexpected browser console exceptions, page errors, failed first-party requests, or CSP violations. Test alerts, keyboard access to affected actions, loading/disabled states, and long/multiline error rendering.

10. Deployment, middleware, and operational coverage

Build the exact `docker/api.Dockerfile` artifact and run it with production-style non-root user, read-only filesystem, tmpfs, dropped capabilities, and database volume configuration. Verify startup migrations, runtime assets/default-rules/config.js, health endpoint, and stop/restart behavior.

Serve the actual build through the Apache configuration with a test TLS certificate. Verify proxy host/forwarded-proto handling, callback URL, SPA routing, public API base URL, cache behavior, MIME types, CORS preflight, allowlisted/disallowed origins, host validation (including configured ports/IPv6 where supported), security headers, and HSTS only in the intended context. Browser enforcement of CSP must be tested; merely checking the header text is insufficient. Include non-default identity/API ports and the multiline import-error UI.

Exercise malformed JSON, missing/incorrect Content-Type, wrong methods, unknown API routes, large rule collections, and classification body limits with Content-Length, no Content-Length, and streaming/chunked bodies. Confirm a client cannot bypass the intended size bound or trigger unbounded memory use.

Distinguish liveness, dependency readiness, and functional health. Define a separate readiness endpoint if deployment needs it; otherwise use an explicit database-backed functional probe. Test database-not-ready startup, later dependency loss, connection recovery, graceful termination during a write, and application restart with preserved committed data.

Configuration process tests should cover required/missing env vars, invalid numeric limits, invalid URLs, legacy database-URL normalization, allowlists, and safe startup diagnostics. Launch separate processes for env-dependent tests to avoid global environment races.

11. CI and local execution design

Split `.github/workflows/test.yml` into independently visible required jobs (or reusable workflows):

| Job | Trigger | Required result |
| --- | --- | --- |
| Static checks + existing unit/component tests | Every PR/push | Formatting, types, lint, build, Rust tests pass |
| PostgreSQL store/migration integration | Every PR/push | Fresh real database, all persistence regressions execute |
| API/auth/provider integration | Every PR/push | Real router/store, controlled outbound HTTP, contracts pass |
| Production Chromium E2E | Every PR/push | Critical import, sign-in, save/reload, classification/error journeys pass |
| Container + real-Keycloak smoke | Every PR/push | Built image, real login, database write, restart/read pass |
| Extended identity/proxy/cross-browser/concurrency | Nightly and release | Complete slower matrix passes; release remains blocked on unresolved failures |

No required suite silently skips when Docker/PostgreSQL is absent. Fail with setup instructions. Audit ignored tests and zero-test executions. Nightly-only scenarios do not count as a green PR gate; release requires fresh passing results for the same commit.

The local entry points are `npm run test:integration`, `npm run test:e2e:production`, and `npm run test:deployment`. Each starts disposable infrastructure, waits for readiness with a deadline, runs its suite, and tears down reliably. The deployment smoke test builds the exact Docker image and checks restart persistence and runtime hardening.

Use unique ports, database names, Compose project names, and browser contexts. Never point tests at a developer/production database. Use deterministic synchronization/barriers for races and controllable clocks for expiry. Avoid sleeps as readiness checks. Treat retries as diagnostic evidence, not automatic erasure of a flaky failure.

Upload JUnit/test summaries, Playwright traces/screenshots, sanitized application/database/stub logs, environment versions, fixture IDs, and random seeds on failure. Retain only synthetic data. Keep migration and database diagnostics available without dumping credentials. Always clean up infrastructure, including failed jobs.

Provisional runtime budgets: fast checks under 5 minutes warm; store/API suites under 5 minutes warm; required browser/container suites under 10–15 minutes warm; extended suite under 30 minutes. Measure baseline before imposing hard budgets. Correctness gates must not be silently dropped to achieve speed.

12. Delivery sequence and acceptance gates

| Phase | Deliverables | Dependency | Exit gate |
| --- | --- | --- | --- |
| 1: Close the database hole | PostgreSQL CI service, isolated store harness, REG-01, explicit integration target | None | Original broken SQL fails the test; corrected query passes; no ignored required DB test |
| 2: Build application harness | Library/router construction, signed-token OIDC stub, provider endpoint seam, shared fixtures | Phase 1 | Authenticated PUT/GET/DELETE runs through production handlers and real DB |
| 3: Complete store and HTTP contracts | Private/community/legacy/migration/rollback tests, endpoint matrix, frontend schema validation | Phase 2 | Every SQL statement and route has success/failure evidence and isolation assertions |
| 4: Cover auth/provider failures | Token/JWKS/refresh matrix, provider envelopes, rate/time/body bounds | Phase 2 | Controlled faults yield specified status and no unintended side effects |
| 5: Expand import and frontend workflows | Real anonymized fixtures, bank-aware numbers, visible errors, sync/storage race tests | Can start alongside Phase 1 | REG-02 through REG-06 and supported-bank matrix pass |
| 6: Add production E2E | Built bundle/Rust/Postgres, actual browser authentication, persistence/AI journeys | Phases 3–5 | Browser save/reload reads durable SQL data; no application API interception |
| 7: Validate deployment and real identity | Real Keycloak, image startup/restart, Apache/TLS, CSP/CORS, upgrade fixtures | Phase 6 | Same artifact intended for deployment passes functional smoke and upgrade checks |
| 8: Harden and maintain | Cross-browser, concurrency/fault schedule, coverage ledger, regression/mutation drills | Phases 1–7 | Every inventory row has an executable owner or explicitly tracked unsupported behavior |

Prefer small reviewable PRs corresponding to a phase or cohesive subset. Fix defects exposed by tests with a failing regression first. Do not turn unexpected behavior into a passing assertion without deciding whether that behavior is correct.

13. Completion criteria and maintenance

The current implementation meets the executable coverage recorded as `implemented` in `docs/integration-coverage.csv`. Real Keycloak login/refresh/logout, Apache/TLS proxying, and cross-browser schedules remain release-track work; they are not represented as green required coverage. Every deferred row has an owner/boundary and reason so it cannot be mistaken for a passing test.

Measure Rust/TypeScript coverage to locate unexecuted code, but use the scenario inventory as the acceptance authority. Require all high-priority rows to pass; document lower-priority deferred scenarios with owner and reason rather than claiming universal coverage.

Prove test sensitivity with targeted temporary mutations: remove the SQL conflict target, change the DKB grouping interpretation, allow a missing amount as zero, remove subject filtering, suppress a UI error, and bypass a provider-schema check. Each must fail an appropriate test. Run these only in isolated test branches/jobs, never ship the mutations.

Every future bug adds a regression at the boundary where it escaped. Every new endpoint, migration, bank format, privacy setting, or dependency change updates the coverage inventory and its owning tests in the same PR. Review flaky tests as defects with owners; do not accumulate permanent skips.

Before calling this plan implemented, report actual suite results, runtime, skipped cases, environments, and remaining gaps. A plan, a compiling test, and an executed passing integration test are three different states.

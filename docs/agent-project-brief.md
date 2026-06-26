# Metapi Agent Project Brief

This note is for future coding agents working in this repository. It summarizes
the parts of `docs/` and `src/` that matter most when changing the project.

## Product Shape

Metapi is a TypeScript full-stack project that aggregates multiple AI API
providers and relay platforms behind one management console and one compatible
proxy gateway.

Main user-facing concepts:

- Sites: upstream providers or relay platforms such as New API, One API,
  OneHub, DoneHub, Veloera, AnyRouter, Sub2API, CPA, OpenAI, Claude, Gemini,
  Codex, Gemini CLI, and Antigravity.
- Accounts and account tokens: upstream credentials, sessions, API keys, OAuth
  connections, and per-token model availability.
- Token routes and channels: routing rules from requested models to upstream
  accounts/tokens, with weighted routing, cooldowns, health, and route units.
- Proxy surfaces: `/v1/*`, Claude messages, Gemini generateContent, files,
  images, videos, search, and model listing.
- Management console: React admin UI for sites, accounts, routes, logs,
  settings, OAuth, downstream API keys, monitoring, models, and playground.
- Desktop app: Electron wrapper that starts the same server and serves the web
  UI.

## Existing Docs Map

- `docs/index.md`: public VitePress home page and screenshots.
- `docs/README.md`: documentation maintenance map and contribution rules.
- `docs/getting-started.md`: first deployment and first proxy request.
- `docs/deployment.md`: Docker, desktop, local development, reverse proxy,
  upgrade, rollback.
- `docs/configuration.md`: UI settings vs environment variables.
- `docs/upstream-integration.md`: platform-specific site/account integration
  guide.
- `docs/oauth.md`: Codex, Claude, Gemini CLI, and Antigravity OAuth flows.
- `docs/client-integration.md`: downstream clients and `/v1/*` usage.
- `docs/management-api.md`: scriptable `/api/*` management endpoints.
- `docs/operations.md`: backups, restore, logs, health checks, maintenance.
- `docs/faq.md`: common operational and integration failures.
- `docs/k3s-update-center.md`: advanced K3s/Helm update center.
- `docs/project-structure.md`: stable directory placement rules.
- `docs/engineering/harness-engineering.md`: architecture guardrails and drift
  check rationale.
- `docs/community/faq-tutorial-guidelines.md`: FAQ/tutorial writing template.

When code behavior changes a public workflow, update the relevant user-facing
page. When changing boundaries or structure, update this brief and, if needed,
`docs/project-structure.md` or `docs/engineering/harness-engineering.md`.

## Source Map

Top-level source directories:

- `src/server`: Fastify server, database, management API, proxy API, platform
  adapters, OAuth, route selection, background jobs, update helper.
- `src/web`: Vite React admin console.
- `src/desktop`: Electron main process and desktop server runtime helpers.
- `src/shared`: browser/server-neutral contracts and helpers.

Important server directories:

- `src/server/index.ts`: process startup. It bootstraps the runtime database,
  hydrates settings, runs compatibility shims, seeds default/OAuth sites,
  rebuilds routes, registers all Fastify routes, starts schedulers, and serves
  the production web bundle.
- `src/server/config.ts`: environment parsing and default runtime config.
- `src/server/db/schema.ts`: Drizzle schema source of truth.
- `src/server/db/index.ts`: runtime database connection layer for SQLite,
  MySQL, and Postgres, plus legacy compatibility helpers.
- `src/server/db/generated/*`: checked-in schema contract and generated
  cross-dialect SQL artifacts.
- `src/server/routes/api`: management API adapters. Keep these thin.
- `src/server/routes/proxy`: proxy route adapters for `/v1/*` and compatible
  protocol endpoints. Keep orchestration, retry, billing, and protocol
  conversion out of route files when possible.
- `src/server/proxy-core`: proxy orchestration, channel selection, endpoint
  fallback, provider profiles, runtime executors, and proxy surfaces.
- `src/server/transformers`: protocol-pure request/response conversion for
  OpenAI chat, OpenAI responses, Anthropic messages, Gemini generateContent,
  and canonical/shared formats.
- `src/server/services`: business services, platform adapters, OAuth services,
  route rebuild/selection, billing, logs, background tasks, notifications,
  update center, site proxy handling, model discovery.
- `src/server/services/platforms`: upstream management-plane platform
  adapters. `index.ts` controls detection/registration order, and `base.ts`
  defines the adapter contract.
- `src/server/services/oauth`: provider OAuth flows, account persistence,
  quota, route units, refresh, local callback server.

Important web directories:

- `src/web/App.tsx`: login shell, layout, lazy route registration, global
  panels.
- `src/web/api.ts`: authenticated management API client used by pages.
- `src/web/pages`: top-level admin pages. Do not import one top-level page from
  another; extract shared pieces into components/helpers/domain subfolders.
- `src/web/pages/helpers`: page-level reusable logic.
- `src/web/components`: shared UI primitives, modals, responsive mobile
  primitives, charts, brand icons, toast/search/notification surfaces.
- `src/web/index.css`: global UI styling.

Important desktop files:

- `src/desktop/main.ts`: Electron main process.
- `src/desktop/runtime.ts`: desktop server env, port, readiness, and working
  directory helpers.
- `src/server/desktop.ts`: server-side desktop public routes and static
  adaptation.

## Core Boundaries

Follow `AGENTS.md` and `docs/engineering/harness-engineering.md` first.

- Routes are adapters. A route may register Fastify handlers, read request
  context, validate simple inputs, and delegate. It should not own protocol
  conversion, retry loops, stream lifecycle, endpoint fallback, billing, or
  persistence-heavy orchestration.
- `src/server/proxy-core/**` owns proxy orchestration. Endpoint fallback should
  go through `executeEndpointFlow()` in
  `src/server/proxy-core/orchestration/endpointFlow.ts`.
- Proxy surface bookkeeping such as sticky sessions, leases, OAuth refresh,
  success/failure handling, usage fallback, billing, logs, and alerts should
  go through `src/server/proxy-core/surfaces/sharedSurface.ts`.
- Whole-body upstream response reads in proxy orchestration should use
  `readRuntimeResponseText()` from `src/server/proxy-core/executors/types.ts`.
- `src/server/transformers/**` must stay protocol-pure. Do not import Fastify
  routes, route helpers, OAuth services, token router, or runtime dispatch from
  transformers.
- Platform capability must be explicit. Add platform behavior in the adapter,
  shared identity/capability helpers, provider profile, or a tested service
  rather than scattering `platform === ...` checks.
- Database schema changes require synchronized outputs: Drizzle schema,
  SQLite migration history, and generated checked-in artifacts.
- Web pages are orchestration surfaces. Reuse `ResponsiveFilterPanel`,
  `ResponsiveBatchActionBar`, `MobileCard`, `useIsMobile`, and
  `mobileLayout.ts` before creating new mobile-specific behavior.

## Key Runtime Flows

### Server Startup

`src/server/index.ts` does the following in order:

1. Bootstrap the runtime database with `ensureRuntimeDatabaseReady()`.
2. Load saved settings, possibly switch runtime database, and apply runtime
   settings.
3. Run narrow compatibility shims for existing installs.
4. Repair timestamps, migrate legacy site API keys, seed default sites, backfill
   OAuth identities, and rebuild routes.
5. Ensure OAuth provider sites exist.
6. Register management routes, proxy routes, and production static web serving.
7. Start schedulers for check-in, backup, announcements, model probes, channel
   recovery, Sub2API refresh, update center, usage aggregation, admin snapshot
   warming, OAuth callback servers, and retention cleanup.

### Proxy Request

Typical proxy flow:

1. `src/server/routes/proxy/router.ts` applies proxy auth and registers the
   concrete route module.
2. Route module delegates to a proxy-core surface such as `chatSurface.ts` or
   `openAiResponsesSurface.ts`.
3. Surface selects a channel via `selectProxyChannelForAttempt()` /
   `tokenRouter.selectChannel()`.
4. Surface builds endpoint candidates and calls `executeEndpointFlow()`.
5. Runtime dispatch may use the default fetch path or provider-specific
   executors for Codex, Gemini CLI, Claude, or Antigravity.
6. Transformers convert between downstream and upstream protocols.
7. Shared surface logic records usage, billing, proxy logs, cooldowns, OAuth
   quota hints, token expiry alerts, and retry decisions.

### Route Selection

`src/server/services/tokenRouter.ts` is the main route/channel selector. It
uses token route patterns from `src/shared/tokenRoutePatterns.js`, route
contracts from `src/shared/tokenRouteContract.js`, runtime health, cost,
balance, usage, cooldowns, route units, and downstream policy.

When adjusting routing behavior, look for adjacent tests named
`tokenRouter.*.test.ts`, route decision tests under `routes/api/tokens.*`, and
web route UI tests under `src/web/pages/token-routes`.

### Platform Management

`src/server/services/platforms/index.ts` registers platform adapters in
specific-to-generic detection order. `PlatformAdapter` in `base.ts` owns
management-plane behaviors: detection, login, token verification, user info,
check-in, balance, models, API tokens, site announcements, groups, and token
creation/deletion.

Use this layer for site/account management behavior. Use proxy-core provider
profiles/executors for data-plane behavior of provider-native runtimes.

### OAuth Provider Accounts

OAuth provider support is split across:

- `src/server/services/oauth/providers.ts`: provider registry.
- `src/server/services/oauth/service.ts`: OAuth session/service logic.
- `src/server/services/oauth/*Provider.ts`: provider-specific details.
- `src/server/services/oauth/oauthSiteRegistry.ts`: automatic provider site
  records.
- `src/server/routes/api/oauth.ts`: management API adapter.
- `src/web/pages/OAuthManagement.tsx`: UI.

OAuth provider accounts should usually be managed from OAuth flows, not by
ordinary site/account login paths.

### Database Schema

The primary schema is `src/server/db/schema.ts`. Runtime supports SQLite, MySQL,
and Postgres through proxy drivers in `src/server/db/index.ts`. Cross-dialect
bootstrap/upgrade artifacts are generated into `src/server/db/generated`.

For schema changes:

1. Edit `src/server/db/schema.ts`.
2. Generate Drizzle migration and schema contract/artifacts.
3. Keep generated SQL and contract JSON checked in.
4. Add/adjust schema tests and any narrow legacy compatibility shim if existing
   installs need it.

Useful scripts:

- `npm run db:generate`
- `npm run schema:contract`
- `npm run schema:generate`
- `npm run test:schema:unit`
- `npm run test:schema:parity`
- `npm run test:schema:upgrade`
- `npm run test:schema:runtime`
- `npm run smoke:db:sqlite`
- `npm run smoke:db:mysql`
- `npm run smoke:db:postgres`

### Web UI

Vite root is `src/web` (`vite.config.ts`). Dev proxy forwards `/api`, `/v1`,
and `/monitor-proxy` to the server. `App.tsx` lazy-loads route pages:

- `/`: dashboard
- `/sites`: sites
- `/site-announcements`: site announcements
- `/accounts`: accounts
- `/oauth`: OAuth management
- `/tokens`: account tokens
- `/checkin`: check-in log
- `/routes`: token routes
- `/logs`: proxy logs
- `/monitor`: monitors
- `/settings`: runtime settings
- `/downstream-keys`: downstream API keys
- `/events`: program logs/events
- `/settings/import-export`: import/export
- `/settings/notify`: notification settings
- `/models`: model marketplace
- `/playground`: model tester
- `/about`: about/update center entry

When adding or changing UI API calls, update `src/web/api.ts` and prefer typed
payloads for new stable surfaces.

## Common Change Recipes

### Add Or Change A Management API

1. Add/adjust a thin handler in `src/server/routes/api`.
2. Put business logic in `src/server/services`.
3. Put shared request/response payload types in `src/server/contracts` when
   the shape is reused or should be pinned.
4. Add route/service tests near the changed files.
5. Update `src/web/api.ts` and the relevant page if the UI uses it.
6. Update `docs/management-api.md` if scripts/users should know about it.

### Add Or Change A Proxy Endpoint

1. Register only the endpoint adapter in `src/server/routes/proxy`.
2. Put lifecycle and execution behavior in `src/server/proxy-core`.
3. Put protocol conversion in `src/server/transformers`.
4. Use `executeEndpointFlow()` for endpoint fallback.
5. Use `readRuntimeResponseText()` for full response body reads.
6. Add focused transformer, proxy-core, and route tests.
7. Run `npm run repo:drift-check` before finishing.

### Add A New Platform Adapter

1. Create `src/server/services/platforms/<platform>.ts`.
2. Implement the `PlatformAdapter` contract honestly; unsupported features
   should return narrow defaults rather than pretending to be complete.
3. Register the adapter in `src/server/services/platforms/index.ts` in the
   right detection order.
4. Add aliases/URL hints in `src/shared/platformIdentity.js` if needed.
5. Add tests for detection, management behavior, model discovery, and any
   special credential handling.
6. Update `docs/upstream-integration.md` and possibly `docs/faq.md`.

### Add Or Change OAuth Provider Behavior

1. Work in `src/server/services/oauth` and provider profiles/executors where
   needed.
2. Keep route adapter changes in `src/server/routes/api/oauth.ts` thin.
3. Ensure provider site creation still flows through `oauthSiteRegistry`.
4. Add tests for start/session/manual callback/rebind/refresh/quota behavior.
5. Update `docs/oauth.md` and `docs/management-api.md` for user-visible flow
   changes.

### Add A Web Page Feature

1. Keep top-level page orchestration in `src/web/pages/<Page>.tsx`.
2. Extract a second complex modal/drawer/panel family into a page domain
   subfolder.
3. Reuse shared responsive primitives before writing a custom mobile path.
4. Add tests beside the page/helper/component.
5. Update user docs only when the visible workflow changes.

## Commands

Development:

- `npm run dev:server`: watch server.
- `npm run dev`: server plus Vite web dev server.
- `npm run dev:desktop`: server, Vite, desktop TS watch, and Electron.
- `npm run docs:dev`: VitePress docs preview.

Build and typecheck:

- `npm run build`
- `npm run build:web`
- `npm run build:server`
- `npm run build:desktop`
- `npm run typecheck`
- `npm run typecheck:web`
- `npm run typecheck:server`
- `npm run typecheck:desktop`

Tests and guardrails:

- `npm test`
- `npm run repo:drift-check` is required for shared architecture-boundary
  changes.
- Run the schema test scripts for database changes.
- Run `npm run docs:build` for docs/navigation changes.
- For focused tests, pass file paths through the npm script, for example
  `npm test -- src/server/services/tokenRouter.selection.test.ts`.

Packaging:

- `npm run dist:desktop`
- `npm run package:desktop`

## Test Topology

This repository has heavy local tests. At the time this brief was written,
`src` contains more than 900 source/test files and more than 400 colocated
`*.test.ts` / `*.test.tsx` files.

Testing patterns:

- Tests are colocated with source.
- Architecture tests are named with `.architecture.test`.
- Server route tests live beside routes.
- Transformer tests live beside conversion/stream/bridge modules.
- Web tests are React/Vitest tests colocated with pages/components/helpers.
- Vitest forces `NODE_ENV=test` unless a non-production value is already set.

Prefer focused tests first, then broader scripts when the change crosses
boundaries.

## Skill Evaluation

A dedicated Codex skill could help for this project, but it is not mandatory
yet unless future work repeatedly touches proxy, routing, or schema changes.

Recommended decision:

- Do not create a skill immediately just to mirror this brief.
- Create a project-specific skill if future sessions repeatedly need the same
  procedural checklist for one of these high-risk workflows:
  - adding a proxy endpoint or protocol bridge;
  - changing route selection/channel cooldown behavior;
  - adding an upstream platform adapter;
  - changing the database schema across SQLite/MySQL/Postgres;
  - changing OAuth provider runtime behavior.

If created, the skill should be narrow and workflow-oriented, not a copy of the
whole repository map. A good first skill would be `metapi-proxy-change`, with
instructions to inspect route adapters, proxy-core surfaces, transformers,
token router impact, billing/logging side effects, and drift checks before
editing.

This `agent-project-brief.md` is the right lightweight artifact for now:
it improves future orientation without adding another instruction surface that
can drift from `AGENTS.md` and the engineering harness.

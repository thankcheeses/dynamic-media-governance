# ADR 0001: Persistence is an allow-list, and settings are stored as preferences

**Status:** accepted · 2026-11-08

## Context

The main store persisted with a deny-list (`...state` minus exclusions). Two problems followed. A product default (Lights out as the only black theme) could not win over a saved choice without a version bump and a hand-written migration, and the next default change would need the same. Ephemerality was represented three ways, one of them a substring match on audit free text that dropped any entry containing `x-`.

## Decision

- `src/persistence.ts` names every slice that survives a reload (`partializeState`). Anything not named stays in the tab.
- Settings are stored as **preferences**: only the keys that differ from `DEFAULT_SETTINGS`. On load they are merged over the current defaults (`settingsFrom`).
- Ephemerality is a flag: `post.ephemeral`, `event.ephemeral`, or a submission whose `postId` is ephemeral. Free text is never inspected.
- Highlights pins persist (the copy promised "pins stay on this device"); pins on ephemeral posts are dropped with the import.
- Storage version is 3. `migrateState` reads v1 and v2 saves.

## Consequences

- Changing a product default needs no migration unless a saved *preference* must be overridden on purpose.
- A test can assert what persists without a browser (`src/test/store.test.ts`).
- The one-time v1→v2 resets (theme, low power) are preserved inside the migration and still apply to v1 saves.

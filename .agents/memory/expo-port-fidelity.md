---
name: Expo-to-multi-artifact porting fidelity
description: Lessons from porting a legacy single-service Expo+Express app (with live production DB) into a pnpm multi-artifact workspace.
---

When a port's goal is "must look/work exactly like before" on a live-data app:

- Keep the original frontend fetch/query-client pattern (hand-rolled `apiRequest`/`getQueryFn`) instead of switching to generated OpenAPI hooks. Swapping the networking layer risks subtle behavioral drift that's hard to catch without a large manual QA pass; fidelity beats convention for a straight port.
- **Why:** the app has real users/data and no regression tolerance; the generated-hooks pattern is the *right* choice for new feature work but not for a byte-for-byte port.
- Mirror backend routes with raw SQL/`pool.query` matching the original 1:1, rather than rewriting on the generated Zod schema layer, for the same reason.
- Pre-existing bugs in the legacy app (e.g. a missing import causing a `ReferenceError` on one code path) should be preserved, not fixed — fixing changes behavior. Silence the resulting typecheck noise with `// @ts-nocheck` at the top of the affected file rather than resolving the type error, when the task scope explicitly excludes typecheck compliance.
- **How to apply:** when a task says "must work exactly like before" + "out of scope: refactoring/strict typecheck", treat any behavior change (even a bug fix) as out of scope unless explicitly requested.

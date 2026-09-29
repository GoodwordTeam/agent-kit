# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit
`c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`, installed with that commit's
`skills/install-anti-slop/scripts/install.mjs`. MIT; the upstream `LICENSE` sits
beside this file and travels with every copy.

Copied: upstream `src/` minus its `*.test.ts` files (the installer's choice; they
run under `tsx`, and `bun test` would otherwise collect them). Every copied file is
byte-identical to the pin. `vendor/eslint-stylistic/` carries its own license and
provenance.

Registered in `.oxlintrc.json` as the `anti-slop` JS plugin. The Effect plugin
under `effect/` is copied but not registered: agent-kit has no `effect` dependency.

## Local deviations

None in the source. In configuration:

- `anti-slop/require-readable-spacing` is off. oxfmt owns whitespace here; the rule
  inserts blank lines between statements, which no formatter pass satisfies, so the
  two would disagree on every formatted file.
- Upstream builds against `@oxlint/plugins` 1.78.0; agent-kit pins `oxlint` and
  `@oxlint/plugins` together at 1.86.0.

## Updating

Clone upstream at an explicit revision, re-run its installer into a scratch
directory, diff that against this directory, carry any change across, and update
the commit above. Never edit these files in place: a local rule change is a fork,
and belongs beside this directory rather than inside it.

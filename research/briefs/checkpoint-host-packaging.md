# Batch-5 checkpoint — the host-packaging half

Covers one half of the batch-5 checkpoint: what the *host* says about the bundle
we build. The vertical slice (a bounded change driven end to end through the
seven supers) is not in here and is still unrun.

Reproduce: `research/probes/host-validator-reach.sh cdea8a7`, against
`claude 2.1.278`. Donor lines are read from
`.donors/EveryInc_compound-engineering-plugin` at
`05c42da94fd318fa081f29d17bf947762aa477b1`, the pin `adapters/codex/CONTRACT.md`
cites.

## The headline is not the warning, it is the reach

`claude plugin validate dist/claude-code --strict` fails today, on one warning:
the marketplace manifest has no `metadata.description`. That is worth fixing and
it is the least of what this probe found.

**The command in the release criterion reaches one JSON file.** The validator
picks a mode from what it finds, and the modes are disjoint rather than nested:

| path | what it validates |
|---|---|
| bundle root, `marketplace.json` present | that file only |
| bundle root, `marketplace.json` removed | the plugin manifest only |
| a directory with neither | `SKILL.md` files |

So `claude plugin validate dist/claude-code --strict` certifies
`marketplace.json` and reports nothing whatever about the eleven skills beneath
it or about `plugin.json` beside it. Fixing the warning would turn the criterion
green while certifying exactly what it certifies now. A criterion that passes by
examining the smallest population in the bundle is the failure this repository
is organized against, and it was written into the plan as step 3.

## What directory mode catches, measured rather than read

Eight arms, each mutating one copy of the built bundle:

| mutation | `--strict` |
|---|---|
| baseline (unmutated) | passes |
| `description:` deleted | **caught** |
| frontmatter fence removed | **caught** |
| frontmatter YAML malformed | **caught** |
| `name:` deleted | passes |
| `name` does not match its directory | passes |
| `SKILL.md` deleted | passes |
| **all skills removed** | **passes** |

The last row is the one to carry. **This command cannot distinguish a complete
bundle from an empty directory**, so it must never be quoted as evidence that
the skills shipped. The first three arms are what make the last four readable:
had the validator silently examined nothing, every arm would have passed and the
table would have agreed with any hypothesis put to it.

All four blind arms are covered by `ak validate` — frontmatter `name` matching
its directory is a check it owns, and catalog completeness is what refuses a
missing body. **The host validator is not a superset of ours and cannot stand in
for any part of it.** It adds exactly three checks we do not have, all about
frontmatter presence and parseability, and those three are worth having.

## Two defects in the marketplace emitter

Both from `src/packaging/plan.ts:727`, both settled by the donor at the pin
rather than by preference.

**`plugins[0].description` is the package *name*.** The emitter writes
`description: pkg.name`, so the bundle says `"agent-kit"` where `plugin.json`
says `"One engineering lifecycle, amalgamated from six MIT donors."` — one
plugin described two ways in one bundle, and one of the two is not a
description. At the pin the donor's entry description is **byte-identical to its
own `plugin.json` description**, which makes the fix a derivation rather than a
choice: `entry.description = pkg.description`, for the reason the emitter
already gives for `owner` — deriving it means the two cannot disagree.

`cdea8a7` added a `description` guard one commit before this was found, and it
does not reach here. Its own comment is accurate about its scope
(`description` "is checked here and nowhere else") and the scope is the host
manifest; the marketplace entry is a third copy of the field that nothing
compares to the other two.

**`metadata.description` is absent.** The emitter omits it deliberately, and its
stated reason is sound: "the failure this package has already produced once is a
plausible value nobody checked -- so the fields are absent until something in
the tree says what they are." The fix honours that rule instead of overriding
it. The donor's `metadata.description` ("Plugin marketplace for Claude Code and
Codex extensions") is a **different text from its plugin description**, about a
different object — a marketplace, not a plugin — so this one cannot be derived
from `package.description` and needs a value stated in `catalog.yaml`. Add the
field to the tree; then the emitter is emitting something the tree says, which
is what its rule asks for. `homepage` and `tags` stay absent: the tree still
says nothing about either.

## One citation that held

`src/packaging/plan.ts:563` asserts that `--strict` "treats a key it does not
define as an error" and quotes the host verbatim. Tested by injecting an `ak`
key into the manifest: `Unknown field 'ak'. Claude Code ignores it at load
time.`, `--strict` fails. The comment is exactly right, and the decision resting
on it — `buildRecord` living beside the manifest rather than inside it — is
well founded. Recorded because a report that only lists the citations that broke
misleads about the rate.

## The register entry this produced

**An instrument cited as authority and never executed.** `claude plugin
validate` is named in four source comments and in the plan's release criteria,
and until this probe nothing in `src/`, `tests/` or `package.json` had ever run
it. The citations were not careless — one of them is quoted correctly down to
the error string — but three of the eight arms above contradict what the release
criterion assumes about the command's reach, and no amount of reading the help
text would have produced that table. The distance between citing a tool and
running it is not a matter of diligence: it is the same gap as between a check
and its own tests, and it closes only by execution.

Related: [a check that exists only in its own tests], and the rule that a figure
must name its instrument.

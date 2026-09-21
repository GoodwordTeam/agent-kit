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

---

# Batch-5 checkpoint — the behavioural half

Run after the packaging half, against `claude 2.1.278`. Total spend ~$1.60.

## The corpus had never been loaded by the runner

87 of 87 cases in the shipped bundle failed to load; none had ever executed.
`ak validate` reported 0 errors on all 104 at the same revision. One key:
`llm` graders take `criteria`, every one of the 256 here carried
`expected_outcome`, and the host refuses it as an unrecognized key.

Fixed at `c9fdcda` against the host rather than against §9. See that commit for
the three-agreeing-sources argument; it is the register entry.

## Not fixed, and it blocks the behavioural tier by itself

**No case declares a fixture. 0 of 104.** The sandbox hands the run an empty git
repo — `home/cwd` empty, `home/.git` holding four files and no objects — so a
case saying "delta review on the retry-policy fix, only the two files in the
diff are in scope" is asking about a change nothing created.

One case was run end to end. It scored 0.00 on all three graders. The trace
shows the agent doing the right thing and being marked wrong for it: it named
the two paths it inspected, said the repo had no commits and no tracked files,
distinguished read-only filesystem inspection from what `git diff` would have
told it, named the tool it did not have, and offered three concrete unblocks.
Then all three `llm` graders failed it, because each one asks whether a review
was produced.

Two consequences, and the second is worse than the first:

**A corpus with no fixtures scores correct refusal as failure.** It grades
against `fail closed when required evidence is absent` — the package's own
ruling — and would reward a skill that invented a review over one that refused.

**It cannot measure triggering either.** The trace shows no `Skill` invocation,
so `super-review` did not fire. With no fixture present that observation is
unattributable: "the skill does not trigger" and "there was nothing to trigger
on" predict the same trace. A case with no fixture is not a weak test. It
returns the same result under every hypothesis about the skill, which is the
definition this register already carries for a control that does not run.

## Where `scaffold_script` goes is undetermined — do not guess it

`--scaffold` and `--no-scaffold` are real flags and `scaffold_script` is the
name in the host's own help text. Two placements were tried, each with a script
writing a marker file, run under `--scaffold --keep-temp`: at the top level of
`case.yaml`, and under `execution:`. **Neither ran.** No marker appeared in the
sandbox or in the bundle.

Both were also *accepted* by the loader, which proves nothing: the host's
top-level case object is **open**. A key spelled `zzz_not_a_field` is accepted
there too. Only the grader object is closed, which is where the corrected
control fired (`Unrecognized key(s) in object: 'zzz_not_a_field'`) and is the
only reason the acceptance results above are readable at all.

So the placement is unresolved, and the next step is **not** another guess.
Brute-forcing a host field name is the error that produced this whole section:
three documents agreed on `expected_outcome` because nobody asked the runner.
Find the authoritative format for the case file — the host's own documentation
for `claude plugin eval` — and author fixtures against it. `schemas/case.schema.json`
closes `execution` on three keys and will refuse `scaffold_script` there, so
that schema is part of the same change.

## Cost discipline

The before/after figures for the load failure cost $0.00, using
`--max-cost-usd 0.01`, which loads every case and aborts before launching runs.
Exactly one run leaks past the ceiling by design ("checked before each run
launches"), so the ceiling bounds a sweep but never makes one free.

`--case <glob>` filters **before** validation. A load-check narrowed with
`--case` reports zero failures because it loaded zero cases; only `--case "*"`
validates the corpus. One reading here was lost to that and one to a failed
build step feeding an empty grep. Both were caught by asking for the count of
cases loaded beside the count that failed, which is the only form in which
either number means anything.

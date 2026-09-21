# Contract defects

Where a writer reports that following `AUTHORING.md` produced a wrong result.

**`AUTHORING.md` §10 governs this file** — what counts as a defect, the three things an entry
records, and the rule that an open entry blocks its batch commit until the contract owner rules.
Read it there. It is deliberately not restated here: a restatement that drops a clause reads as
complete, and this file is the one place a writer arrives already believing they know the rule.

The file lives at the repository root for one reason. An entry appears in the diff of the very
commit that would otherwise bury it, so readership does not depend on anyone remembering a path.
A contract defect filed inside a commissioned artifact is the failure mode §10 names, and batch 1
produced a worked example of it: a correct diagnosis about §5's `target:`/`path:` key was filed in
a provenance fragment header, §5 was fixed at `abeb94e`, and nothing was obliged to read the report
so nothing retired it. It sat there asserting something untrue about the contract until a reviewer
found it.

An entry is retired by deleting it in the commit that resolves it, with the ruling in the commit
message. Entries are not marked resolved and left in place — a resolved entry that stays is the
same artifact as a stale one. There is no resolved section here, for that reason.

Deleting an entry does not lose it. `git log -- CONTRACT-DEFECTS.md` is the index of every defect
this contract has ever had, and each resolving commit carries the entry it retired along with the
ruling. Read it there before concluding from an empty list that nothing has been found.

---

## Open

### §9 sends an observable claim to `llm`, and an `llm` grader does not look at the disk

**The instruction followed.** §9: "Prefer a deterministic grader (`regex`, `file_exists`,
`tool_order`) over `llm` wherever the pass criterion is observable; use `llm` for the judgment
cases, with `criteria` that a reader could score by hand." And, in the same section, "`file_exists`
and `tool_order` are named here and specified nowhere in this repository."

**What following it produced.** A writer whose pass criterion is observable is told to prefer
`file_exists`, then told what `file_exists` accepts is unknown, and finds `schemas/case.schema.json`
names no field for it. The only type that can be written is `llm`. §9 does not say — because nothing
in this repository knew — that an `llm` grader is scored against the run's last message unless it
carries a `focus`, and that `focus` is absent from §9, from `schemas/case.schema.json` and from all
256 `llm` graders in the tree. The host states the default itself: "Defaults: `target`/`focus` =
`last_message`".

So 41 of those 256 graders assert something about the filesystem and are scored against the
transcript. `evals/doc-review/durable-output-goes-through-the-knowledgebase/case.yaml` carries the
clearest one, `no-repository-file-created`: "No file is created or edited anywhere in the working
repository." A run that creates files and then does not mention them in its last message passes it.
The graders are not weak; they are pointed at the wrong surface, and nothing in the repository
reports that, because a grader that cannot fail produces no artifact. Reproduce with
`./research/probes/host-case-keys.py`, which takes the key list from the host rather than from here.

**What the correct behavior appears to be.** The host supplies the instruments and this repository
names none of them. `focus: files` scores against the newline-separated list of paths created during
the run; `{source: file, path}` scores against a created file's contents; `file_exists` takes
`path: <glob>` and `exists: bool` and checks that same created-files list, which is the deterministic
form §9 already prefers for exactly this claim. `tool_order` takes `before` and `after`. Those two
field sets close the gap §9 records as unspecified.

I cannot tell how far the remedy should run. Naming the fields in §9 and in
`schemas/case.schema.json` is the contract fix. Whether the 41 graders are then reaimed, and whether
the "no file is created" class becomes `file_exists` with `exists: false`, is a corpus decision
across `evals/`, which this seat does not own and which no schema change should be taken to have
settled. One caution for whoever rules: a grader that moves from `last_message` to `files` may start
failing, and that is the defect surfacing rather than a regression introduced by the fix.

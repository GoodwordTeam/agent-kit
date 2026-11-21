# Goodword fork sync

Status: curated draft; independent re-review and Chris's merge approval are required.

## Current decision

Chris replaced the full-merge proposal with an explicit selection: take the audit's
56 Relevant and 35 Neutral PRs, exclude #180 and #244, and bring over only necessary
dependencies from excluded work. This branch starts at fork main `f1c18e48` and
cherry-picks each selected PR's squash commit or merge commit in upstream first-parent
order through `d6a98f0c`. Merge commits use their first parent as the mainline; their
side-branch histories are not merged. The resulting 91 commits retain upstream
source locators and the fork's original Goodword install-source patch.

Version `0.1.131-goodword.2` identifies this curated bundle. The earlier full-merge
draft is superseded; its results do not establish that this branch passes.

## Exclusions and dependencies

#180's Firstmate preflight wording and its tests remain excluded. #182 needed only
a version-number conflict resolution after that exclusion. #263 needed its guide's
size pin recalculated against the retained guide; its new question/stall instructions
do not require #180's wording.

#244's repository policy file is absent. Its test that expects this repository to
opt into unattended operation is absent, as are its supervisor-specific ship
disclosures and gate-record precedence changes. The optional unattended engine
from selected #183 remains available but is not selected for this repository.

#269 requires a small part of #244: the optional supervisor name, its allowlist and
name stamping when a policy was already explicitly selected. Only that dependency
is imported, along with test-environment isolation for the supervisor variable.
The new #269 stall regression is retained; adjacent #244 regressions are excluded.
Additional checks prove that a supervisor name alone does not select unattended
operation, malformed names refuse, and this repository has no policy opt-in file.

Generated Cursor binaries can contain excluded code even when a later PR changes
unrelated source. Conflicts in #264, #262, #267, #245, #272 and #273 are resolved by
regenerating from the curated source, rather than adopting upstream binary output.
Their source fixes remain selected. Text-size pins are also measured from the
curated files. The ledger records each adjustment and maps all 93 audited PRs.

## Goodword compatibility and canonical home

Keep the Goodword marketplace URLs and source-derived maintenance defaults.
The existing tracker binding still uses the project-local Linear client, ignored
token and ENG team. The in-repository knowledge-base reader from #229 supports
Goodword's wiki binding and remains read-only. Validate old evidence and project
records against current schemas before a pilot.

Goodword's root and most app settings name upstream, while API names the fork;
the inspected settings disable Agent Kit. This source PR changes no monorepo
settings and enables no plugin. Before a pilot, align those sources and confirm
one tested Goodword publication. Keep learning, semantic lint and autonomy off.
Map delivery to Goodword's existing Mergify queue. Publication requires a matching
release tag at the eventual approved main commit; releasing is separate work.

The proposed canonical home remains an unsquashed subtree at `tools/agent-kit` in
goodword-platform. Ordinary clones then contain the source and retain split history.
A plain vendor copy loses history support; a submodule leaves the source outside
the monorepo and adds checkout steps. Import the exact approved fork revision in
a later monorepo PR, author changes there only, and export subtree branches to
the Goodword fork for publication. Offer generic fixes to Eddie through separate,
explicitly authorized upstream PRs. No monorepo files change in this task.

## Future curated sync procedure

1. Start a new branch from the current Goodword main and record the last assessed
   upstream commit from the ledger. Fetch upstream without changing Goodword main.
2. Enumerate the new upstream first-parent commits, map every one to its merged
   PR, and classify each PR for Goodword. Record explicit take/exclude decisions
   and reasons before applying them; retain earlier exclusions.
3. Cherry-pick approved squash commits, or merge commits with first-parent mainline,
   in upstream order. Preserve the original commit locator. Resolve dependencies
   narrowly and record the imported pieces, affected PR and reason in the ledger.
4. Preserve Goodword install sources, keep the repository policy opt-in absent,
   assign a new Goodword bundle version, and regenerate bundles and size pins from
   the curated source. Check generated output for excluded behavior too.
5. Run the full local checks and clean-archive provenance/build checks. Open a
   draft against Goodword's main with the decision table and dependency exceptions.
   Request independent re-review and Chris's merge decision; release separately.

Do not merge upstream wholesale on a future sync: that would restore excluded PRs.
For a monorepo subtree, perform this curated integration on the tracked subtree
history before the monorepo PR, then export the approved split to the fork mirror.

## Technical appendix: evidence and decisions

The machine-readable companion is [goodword-fork-sync-prs.json](goodword-fork-sync-prs.json).
It records upstream and cherry-picked commits in application order. Verification
results will be added before this draft is handed back for re-review.

The following table repeats all audited decisions; Relevant and Neutral rows are
taken, and the two explicit exclusions remain excluded except for the #269
dependency described above. Reasons come from the audit; Chris's later selection
overrides that audit's earlier recommendation to merge everything.

| PR | Upstream commit | Decision | Reason |
|---|---|---|---|
| [#154](https://github.com/Pibomeister/agent-kit/pull/154) | `2906c67b` | Take: Neutral | Builds unattended autopilot for a future runner; the default profile remains core and Goodword will not enable it now. |
| [#155](https://github.com/Pibomeister/agent-kit/pull/155) | `8e9cb5a9` | Take: Neutral | Improves optional learning storage, but raw transcript and judge retention is outside the core-only pilot. |
| [#156](https://github.com/Pibomeister/agent-kit/pull/156) | `09cbedc2` | Take: Neutral | A sensible timeout for the optional Claude learning hook, which Goodword should leave disabled. |
| [#157](https://github.com/Pibomeister/agent-kit/pull/157) | `8864e749` | Take: Neutral | Corrects research citation pins only; no runtime or lifecycle behavior changes. |
| [#159](https://github.com/Pibomeister/agent-kit/pull/159) | `3850268e` | Take: Relevant | Makes local knowledge-base run artifacts append-only and more robust. |
| [#158](https://github.com/Pibomeister/agent-kit/pull/158) | `3d4c466a` | Take: Relevant | Process-owned temporary directories make the maintenance test suite safer and more reliable. |
| [#161](https://github.com/Pibomeister/agent-kit/pull/161) | `3ce7b019` | Take: Relevant | Reduces timing-sensitive runner test failures; useful maintenance hardening. |
| [#160](https://github.com/Pibomeister/agent-kit/pull/160) | `9f5a36dc` | Take: Relevant | Improves runner test diagnostics without changing production behavior. |
| [#162](https://github.com/Pibomeister/agent-kit/pull/162) | `15d4f353` | Take: Relevant | Strengthens independent-seat lineage checks, a property Goodword wants if Orca later uses the runner. |
| [#163](https://github.com/Pibomeister/agent-kit/pull/163) | `0740fb6d` | Take: Relevant | Isolates test and evaluation scratch state per process; generic reliability work. |
| [#164](https://github.com/Pibomeister/agent-kit/pull/164) | `5ee573c7` | Take: Relevant | Fixes the packaged ak executable, directly needed to install and operate the toolkit. |
| [#114](https://github.com/Pibomeister/agent-kit/pull/114) | `e5fde22c` | Take: Relevant | Adds optional, project-owned constitution records and schemas; no personal policy is imposed. |
| [#166](https://github.com/Pibomeister/agent-kit/pull/166) | `0c8a507c` | Take: Relevant | Validates optional project constitution registries; useful project-owned evidence, not an Eddie-specific registry. |
| [#168](https://github.com/Pibomeister/agent-kit/pull/168) | `53515c9c` | Take: Relevant | Fixes packaging of shared roles, protocols, schemas and policies used by the lifecycle. |
| [#169](https://github.com/Pibomeister/agent-kit/pull/169) | `dda64612` | Take: Relevant | Lets Orca workers start review without a typed command while preserving independent seats and approval boundaries. |
| [#167](https://github.com/Pibomeister/agent-kit/pull/167) | `c1f3037b` | Take: Neutral | Adds an external semantic-lint hook and credential surface that the manual pilot does not need. |
| [#171](https://github.com/Pibomeister/agent-kit/pull/171) | `4552d9b4` | Take: Relevant | Closes packaging path and literal-text handling problems; generic safety and correctness work. |
| [#172](https://github.com/Pibomeister/agent-kit/pull/172) | `8f9323d2` | Take: Relevant | Scans public PR text for organization-specific markers, useful protection for Goodword's draft-PR flow. |
| [#174](https://github.com/Pibomeister/agent-kit/pull/174) | `aec656eb` | Take: Relevant | Scales review panels to risk and reviews only new commits, directly reducing duplicate persona work. |
| [#175](https://github.com/Pibomeister/agent-kit/pull/175) | `113ebde3` | Take: Neutral | Repairs optional learning ingestion and reflection; no need to enable that profile in the pilot. |
| [#176](https://github.com/Pibomeister/agent-kit/pull/176) | `3adbd9a6` | Take: Neutral | Repairs optional worker-session capture, but its transcript collection is not part of the core pilot. |
| [#177](https://github.com/Pibomeister/agent-kit/pull/177) | `6abd9016` | Take: Relevant | Lets an independently approved delta close a review correctly; supports bounded Ellie/Dexter follow-up. |
| [#179](https://github.com/Pibomeister/agent-kit/pull/179) | `1c24c806` | Take: Neutral | Adds generic seat-strength guidance, but model placement should remain Crabby/Orca policy rather than Agent Kit's. |
| [#181](https://github.com/Pibomeister/agent-kit/pull/181) | `cfa24803` | Take: Relevant | Adds a lighter route for text-only single-slice tickets, reducing ceremony without dropping required risk checks. |
| [#180](https://github.com/Pibomeister/agent-kit/pull/180) | `f143c8a1` | Exclude: Eddie-specific | Changes only Firstmate stock-preflight behavior and wording; Goodword explicitly does not use Firstmate. |
| [#182](https://github.com/Pibomeister/agent-kit/pull/182) | `56c9aadb` | Take: Relevant | Adds read-economy guidance for scout and build, useful beneath Orca workers. |
| [#165](https://github.com/Pibomeister/agent-kit/pull/165) | `cb8b33b0` | Take: Relevant | Makes work-trail publication resumable and less prone to duplicate writes. |
| [#183](https://github.com/Pibomeister/agent-kit/pull/183) | `82e35808` | Take: Neutral | Adds a substantial unattended policy and GitHub merge gate, but it activates only by explicit project or environment opt-in. |
| [#184](https://github.com/Pibomeister/agent-kit/pull/184) | `b5c01579` | Take: Neutral | Briefly made semantic lint default-on; PR #232 supersedes that behavior, so there is no final default-on effect. |
| [#185](https://github.com/Pibomeister/agent-kit/pull/185) | `cdc29f52` | Take: Neutral | Adds an opt-in council/blind-veto runner feature beyond the manual persona pilot. |
| [#197](https://github.com/Pibomeister/agent-kit/pull/197) | `867b0a14` | Take: Neutral | Adds optional skill-health collection and scoring; sizable learning machinery Goodword does not currently need. |
| [#200](https://github.com/Pibomeister/agent-kit/pull/200) | `eb9cdced` | Take: Neutral | Schedules learning-driven rewrite PRs through no-mistakes; leave it unconfigured because it conflicts with the manual pilot and Mergify mapping. |
| [#202](https://github.com/Pibomeister/agent-kit/pull/202) | `e41edf75` | Take: Relevant | Keeps document-review loops bounded and requires recorded human approval for an extra cycle. |
| [#203](https://github.com/Pibomeister/agent-kit/pull/203) | `d9f7dac0` | Take: Neutral | Adds an optional review-session guard template and test cleanup; no global hook is enabled by it. |
| [#201](https://github.com/Pibomeister/agent-kit/pull/201) | `42230c2b` | Take: Relevant | Fixes canonical receipt-hash handling so superseded evidence cannot be confused with current evidence. |
| [#204](https://github.com/Pibomeister/agent-kit/pull/204) | `fb56d42d` | Take: Neutral | Adds Cursor packaging, which is harmless but outside Goodword's Claude Code, Codex and Kimi host set. |
| [#205](https://github.com/Pibomeister/agent-kit/pull/205) | `0d8b2b8d` | Take: Neutral | Adds a manual review-isolation probe including Mastracode; useful research tooling but not pilot runtime. |
| [#206](https://github.com/Pibomeister/agent-kit/pull/206) | `c8af7511` | Take: Relevant | Repairs generic validation and finding-identity rules used to keep evidence trustworthy. |
| [#207](https://github.com/Pibomeister/agent-kit/pull/207) | `ebb7f5f0` | Take: Neutral | Completes Cursor packaging and license handling; not needed for Goodword's selected hosts. |
| [#208](https://github.com/Pibomeister/agent-kit/pull/208) | `da91ca4a` | Take: Relevant | Warns when host versions changed since isolation probes, helping qualify Claude Code and Codex installations. |
| [#209](https://github.com/Pibomeister/agent-kit/pull/209) | `faee0bbb` | Take: Relevant | Prevents a design report from counting as verification evidence, matching Victor and Timmy's separate jobs. |
| [#210](https://github.com/Pibomeister/agent-kit/pull/210) | `451b5abb` | Take: Relevant | Adds property tests for runner event sequences; useful reliability coverage without enabling autonomy. |
| [#211](https://github.com/Pibomeister/agent-kit/pull/211) | `21247adb` | Take: Relevant | Adds schemas for independent cold reads and review evidence; a sound basis for Victor/Polly handoffs. |
| [#212](https://github.com/Pibomeister/agent-kit/pull/212) | `afed13ad` | Take: Relevant | Makes packaged license closure fail closed; required for a clean Goodword publication fork. |
| [#213](https://github.com/Pibomeister/agent-kit/pull/213) | `07bca15e` | Take: Relevant | Adds an independent document-comprehension seat, off by default, that can complement Victor when selected. |
| [#214](https://github.com/Pibomeister/agent-kit/pull/214) | `f9343718` | Take: Relevant | Adds optional independent ticket cold reads, off by default, to catch tickets that need prior context. |
| [#216](https://github.com/Pibomeister/agent-kit/pull/216) | `499beb63` | Take: Relevant | Keeps shadow comprehension findings advisory and correctly combines blocking checks. |
| [#215](https://github.com/Pibomeister/agent-kit/pull/215) | `2fe67bdc` | Take: Neutral | Vendors a large generated Cursor cloud bundle; inert for Goodword's hosts and adds sync bulk rather than value. |
| [#217](https://github.com/Pibomeister/agent-kit/pull/217) | `ede4f7c1` | Take: Neutral | Fixes packaged dispatch for the optional council command only. |
| [#218](https://github.com/Pibomeister/agent-kit/pull/218) | `6e286aee` | Take: Relevant | Adds per-lane locks and publication checks that protect concurrent Orca evidence updates. |
| [#220](https://github.com/Pibomeister/agent-kit/pull/220) | `59c504c1` | Take: Relevant | Fixes load-sensitive tests without changing runtime policy. |
| [#219](https://github.com/Pibomeister/agent-kit/pull/219) | `188be5bc` | Take: Relevant | Adds a strict fail-closed verdict parser; generic and useful for reliable persona output handling. |
| [#222](https://github.com/Pibomeister/agent-kit/pull/222) | `cbc7b257` | Take: Relevant | Requires current-head receipts and matching release tags; Goodword must preserve this in its publishing workflow. |
| [#221](https://github.com/Pibomeister/agent-kit/pull/221) | `767d99e1` | Take: Neutral | Adds learning-lesson diagnostics and triage that are unnecessary while learning stays off. |
| [#223](https://github.com/Pibomeister/agent-kit/pull/223) | `b1013e72` | Take: Neutral | Tunes runner schema compilation and test timing; harmless, but mostly serves unused autonomy machinery. |
| [#224](https://github.com/Pibomeister/agent-kit/pull/224) | `7b2d31d2` | Take: Relevant | Makes human-input stops explicit and distinguishes unattended advances; improves handoff clarity. |
| [#225](https://github.com/Pibomeister/agent-kit/pull/225) | `b91bc589` | Take: Relevant | Prevents an absent KB from blocking phases while still failing on a configured broken KB; fits Goodword's setup. |
| [#229](https://github.com/Pibomeister/agent-kit/pull/229) | `b3f6b9df` | Take: Relevant | Implements the read-only in-repo wiki backend Goodword already intends to use in the monorepo. |
| [#230](https://github.com/Pibomeister/agent-kit/pull/230) | `e1716acf` | Take: Neutral | Relaxes missing delegation records only under the unattended policy, which Goodword should not activate. |
| [#231](https://github.com/Pibomeister/agent-kit/pull/231) | `9ac1f69d` | Take: Relevant | Makes an unavailable enabled cold read change the delegation risk result rather than silently passing. |
| [#233](https://github.com/Pibomeister/agent-kit/pull/233) | `f2253412` | Take: Neutral | Adds partial adapter-qualification fixtures and templates; useful upstream infrastructure but not pilot behavior. |
| [#232](https://github.com/Pibomeister/agent-kit/pull/232) | `7566406e` | Take: Relevant | Makes the semantic-lint Stop hook opt-in via AK_JEV_ENABLED=1, removing the global-hook concern from default installs. |
| [#234](https://github.com/Pibomeister/agent-kit/pull/234) | `a3b73f60` | Take: Neutral | Improves upstream donor-pin verification and pre-push receipts; maintenance-only and not Goodword policy. |
| [#235](https://github.com/Pibomeister/agent-kit/pull/235) | `903377a8` | Take: Neutral | Adds a synthetic lifecycle evidence fixture and oracle; test infrastructure, not personalized production behavior. |
| [#238](https://github.com/Pibomeister/agent-kit/pull/238) | `9d90f7bf` | Take: Neutral | Removes a stale defect-tracking note only; no lifecycle effect. |
| [#239](https://github.com/Pibomeister/agent-kit/pull/239) | `0f0e1165` | Take: Relevant | Adds validation oracles for document classification, reconciliation and duplicate detection. |
| [#240](https://github.com/Pibomeister/agent-kit/pull/240) | `2667e69f` | Take: Neutral | Adds research evidence scaffolding for held-out and pilot evaluations; no runtime lifecycle wiring. |
| [#243](https://github.com/Pibomeister/agent-kit/pull/243) | `ce3696bd` | Take: Relevant | Requires enabled cold reads to cite a producing run, improving independent-review traceability. |
| [#236](https://github.com/Pibomeister/agent-kit/pull/236) | `80bc403f` | Take: Relevant | Records that review depth follows delegation class, helping avoid repeated full-panel reviews. |
| [#247](https://github.com/Pibomeister/agent-kit/pull/247) | `54e13c57` | Take: Relevant | Improves delegation scoring from actual diff and shared-surface evidence, useful for Polly/Orca planning. |
| [#248](https://github.com/Pibomeister/agent-kit/pull/248) | `e0232821` | Take: Relevant | Clarifies that lighter review does not bypass the delivery pipeline's independent Review step. |
| [#263](https://github.com/Pibomeister/agent-kit/pull/263) | `ccdd5d2b` | Take: Neutral | Adds runner question prioritization and stall alarms for autopilot; useful later, not needed for manual Orca dispatch. |
| [#244](https://github.com/Pibomeister/agent-kit/pull/244) | `64cdfbb5` | Exclude: Risky for Goodword | Commits ak.lifecycle.json with policy=unattended in the fork itself; override it to preserve a manual Agent Kit development/pilot posture. |
| [#260](https://github.com/Pibomeister/agent-kit/pull/260) | `d1b2da03` | Take: Relevant | Isolates legacy packaged-gate tests from unattended launch policy; prevents configuration leakage in tests. |
| [#249](https://github.com/Pibomeister/agent-kit/pull/249) | `e770ab4e` | Take: Neutral | Tunes Eddie's no-mistakes CI gate only; Goodword still needs its own Mergify/draft-PR mapping. |
| [#250](https://github.com/Pibomeister/agent-kit/pull/250) | `6f947efe` | Take: Neutral | Excludes generated bundles from no-mistakes review coverage; repository maintenance only. |
| [#237](https://github.com/Pibomeister/agent-kit/pull/237) | `acf922c2` | Take: Neutral | Changes autopilot retry behavior only; irrelevant while autonomy is disabled. |
| [#264](https://github.com/Pibomeister/agent-kit/pull/264) | `29f54b1f` | Take: Neutral | Classifies held human-only steps under unattended operation; no effect in a manual core run. |
| [#262](https://github.com/Pibomeister/agent-kit/pull/262) | `973386dd` | Take: Relevant | Retries transient empty git listings so existing evidence paths are not falsely reported missing. |
| [#268](https://github.com/Pibomeister/agent-kit/pull/268) | `c2e4678e` | Take: Relevant | Aligns review instructions with accepted delta policy, reducing inconsistent reviewer behavior. |
| [#267](https://github.com/Pibomeister/agent-kit/pull/267) | `95a17df9` | Take: Relevant | Closes publication-scan input bypasses, strengthening the public-PR safety check Goodword should keep. |
| [#242](https://github.com/Pibomeister/agent-kit/pull/242) | `a850cc07` | Take: Relevant | Distinguishes unreadable KB history from missing ancestry, avoiding false coverage claims. |
| [#246](https://github.com/Pibomeister/agent-kit/pull/246) | `935de779` | Take: Relevant | Makes the light-route exemption to cold reads explicit and testable rather than ad hoc. |
| [#241](https://github.com/Pibomeister/agent-kit/pull/241) | `cdc48cdd` | Take: Relevant | Reads cold-read policy from the checkout's project record, the right ownership boundary for Goodword. |
| [#269](https://github.com/Pibomeister/agent-kit/pull/269) | `bfe69ff4` | Take: Neutral | Checks human-step stalls during supervised unattended evaluation only; outside the manual pilot. |
| [#270](https://github.com/Pibomeister/agent-kit/pull/270) | `ed45d062` | Take: Neutral | Improves fallback handling for optional learning judge calls; no core lifecycle effect. |
| [#245](https://github.com/Pibomeister/agent-kit/pull/245) | `955c1562` | Take: Relevant | Freezes behavior-verification policy at run open so later edits cannot weaken a run's obligations. |
| [#271](https://github.com/Pibomeister/agent-kit/pull/271) | `818ab088` | Take: Relevant | Fixes test tooling compatibility with gawk; generic portability maintenance. |
| [#272](https://github.com/Pibomeister/agent-kit/pull/272) | `1a656eeb` | Take: Relevant | Fixes charter-base verdict resolution and KB binding behavior; generic evidence correctness. |
| [#273](https://github.com/Pibomeister/agent-kit/pull/273) | `6e9466cb` | Take: Relevant | Verifies frozen-run writes and avoids deleting another run's files, important for concurrent Orca work. |
| [#278](https://github.com/Pibomeister/agent-kit/pull/278) | `a3949b64` | Take: Relevant | Improves diagnostics for a synthetic lifecycle oracle; generic test maintenance. |
| [#277](https://github.com/Pibomeister/agent-kit/pull/277) | `df3310ec` | Take: Relevant | Adds a deterministic review-convergence ledger, but its ADR confirms no skill or gate calls it yet. |
| [#276](https://github.com/Pibomeister/agent-kit/pull/276) | `d6a98f0c` | Take: Neutral | Retries optional learning judge availability failures; no effect with learning disabled. |

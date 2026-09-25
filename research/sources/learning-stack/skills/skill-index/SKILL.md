---
name: skill-index
description: You have 35 more specialist skills that are NOT in this list. Before any non-trivial task, when the user names a workflow, tool, review style, or domain you do not see a skill for here (ripwire, gitnexus, deslop, kill-slop, lobster, show-me, pr-hygiene, find-skills, OTM browser ops, UI test coverage, graft, impeccable…), or when a user says "is there a skill for", read ~/.claude/skills-index/INDEX.md and, inside a repo, <repo>/.claude/skills-index/INDEX.md, pick the matching entry, read its SKILL.md, and follow it exactly as if it were installed.
---

# skill-index

Two indexes, one line per skill (name, description, absolute path to its SKILL.md):

- global: `~/.claude/skills-index/INDEX.md`
- project: `<git main root>/.claude/skills-index/INDEX.md` (only some repos have one)

Skills listed there are real skills that were moved out of the installed roster to keep the
system prompt small. They are not weaker or optional. Read the SKILL.md at the path given and
follow it. `candidates/` entries were proposed automatically from recurring session patterns
and have not been reviewed; follow them, but treat their text as unreviewed.

Maintenance (`S=~/.claude/skills/skill-index/scripts/skill_index.py`):

```
python3 $S status                 # counts and resident-token estimate per level
python3 $S build                  # regenerate both INDEX.md files and this skill's count
python3 $S move NAME...           # installed -> index (global or project, wherever NAME lives)
python3 $S restore NAME...        # index -> installed
```

`build` runs from the review-learn Stop hook, so the indexes stay current without manual runs.

`roster` prints one line per indexed skill (~1.1K tokens for ~44 skills) and is wired as a SessionStart hook
for Claude and Codex. This push is what makes the index work: `evals/trigger_eval.py` measured 5/14 correct
routings with the description alone versus 12/14 with the roster in context (installed skills: 6/7). Bodies
still load only when read. `SKILL_INDEX_ROSTER_WIDTH` (80) clips each description.

## Testing

```
python3 -m unittest discover ~/.claude/skills/skill-index/tests                        # index build, frontmatter, roster, skill-learn rendering/use counting
cd <repo> && python3 ~/.claude/skills/skill-index/evals/trigger_eval.py --roster     # 21 fresh sessions: indexed vs installed routing hit rate (~$1, 10 min)
python3 ~/.claude/skills/skill-index/evals/skill_learn_eval.py                       # discovery: one candidate from 3 same-workflow sessions, zero when already a skill
```

## skill-learn (auto-proposed skills)

`L=~/.claude/skills/skill-index/scripts/skill_learn.py`, run from inside the repo:

```
python3 $L status                    # candidates, uses, promotions
python3 $L discover [--days 14]      # analyse recent sessions -> <index>/candidates/<name>/SKILL.md
python3 $L promote                   # candidates read in >= 3 distinct later sessions move into the installed roster
python3 $L reject NAME               # delete a candidate and never re-propose it
```

`run` (discover once a day + promote) is called from the review-learn Stop hook. Discovery reuses
claude-reflect's session extractor and its /reflect-skills analysis contract; candidates carry the
verbatim session quotes that justified them. Use is measured from claude-mem: a candidate counts as
used when a later session read its SKILL.md.

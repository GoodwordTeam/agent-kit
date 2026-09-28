# Authoring discipline

Loaded on demand by `writing-skills` at steps 4 and 6. The body carries the gates: no wording
before a failing case, no promotion by the author. This file carries the technique behind them.
The package's own rules on size, sections, frontmatter and evals live in `AUTHORING.md`, and
nothing here restates them.

## Contents

- The cycle
- Match the form to the failure
- Bulletproofing a discipline failure
- Writing the pressure case
- Testing by skill type
- Micro-testing wording
- Where material sits

## The cycle

| Test-first idea | Skill authoring |
|---|---|
| Test case | An eval case under `evals/<id>/` that presses on the failure |
| Production code | The skill body and its `skill.yaml` |
| Red | The case fails without the change: the agent breaks the rule, or produces the wrong output |
| Green | The case passes with the change present |
| Refactor | Close each new loophole while the cases stay green |

The baseline records what the agent did, which options it chose, and its rationalizations word for
word. Guidance written for rationalizations nobody observed is guidance for a hypothetical case.

## Match the form to the failure

Classify the baseline failure before writing any guidance. The form that fixes one failure type
makes another worse.

| Baseline failure | Right form | Wrong form |
|---|---|---|
| Knows the rule and breaks it under pressure | Prohibition, a rationalization table and red flags | Soft guidance: "prefer", "consider" |
| Complies, but the output has the wrong shape | A recipe: state what the output is, its parts, in order | A list of prohibitions: "don't restate", "never narrate" |
| Leaves out a required element of an output it already produces | A required field or slot in the template it fills | A prose reminder near the template |
| Should behave differently under a condition | A conditional keyed to an observable predicate | An unconditional rule with exemption clauses |

Why prohibitions fail on shape problems: under a competing incentive, an agent negotiates with
"don't X". In the donor's head-to-head wording tests, the prohibition produced more of the unwanted
content than the recipe did. A recipe leaves nothing to negotiate: the output has the stated shape
or it does not. Negation also puts the forbidden behavior into context, which makes it more
available. State the target behavior, and keep a prohibition only as a guardrail that cannot be put
positively, paired with the positive target.

For whichever form you pick:

- **No nuance clauses.** "Don't X unless it matters" reopens the negotiation. Write a real exception
  as its own conditional on an observable predicate.
- **Exemption clauses don't scope.** "This limit does not apply to code blocks" still suppresses
  code blocks. If part of the output must be exempt, restructure so the rule cannot reach it.

## Bulletproofing a discipline failure

Only for an agent that knows the rule and skips it under pressure.

1. **Close each loophole by name.** State the rule, then forbid each workaround the baseline showed.
2. **Answer letter-against-spirit early.** When the baseline argues it kept the spirit, add near the
   top: breaking the letter of the rule is breaking its spirit.
3. **Build the table from the baseline.** Every rationalization the agent gave becomes a row; none is
   invented. This package's table has three columns (`AUTHORING.md` fixes them).
4. **List the red flags.** The phrases that mean the agent is about to rationalize, so it can check
   itself.
5. **Put the violation symptoms in the trigger.** The description names the moment just before the
   rule is usually broken.

Persuasion by skill type: a discipline skill uses authority, commitment and social proof; a technique
skill uses moderate authority; a reference skill uses clarity only. The test for any of it: would the
technique serve the human's real interest if they understood it fully? False urgency and guilt fail
that test.

## Writing the pressure case

Pressures, best combined three or more in one case:

| Pressure | Example |
|---|---|
| Time | An outage, a deadline, a closing deploy window |
| Sunk cost | Hours of work that the rule would discard |
| Authority | A senior engineer says to skip it |
| Economic | A job, a promotion or a launch at stake |
| Exhaustion | The end of the day |
| Social | Seeming dogmatic or inflexible |
| Pragmatic | "Be pragmatic, not dogmatic" |

A good case gives concrete options, real constraints with times and consequences, real paths, makes
the agent act rather than describe, and leaves no easy way out. Supply the conditions only: a
prompt that states the rationalization it wants refused tests reading, not the gate.

## Testing by skill type

| Type | Test with | Passes when |
|---|---|---|
| Discipline | Pressure cases, several pressures combined | The rule holds under the most pressure |
| Technique | Application, variation and missing-information cases | The technique is applied to a new case |
| Pattern | Recognition, application and counter-example cases | It is applied when it fits, and not when it does not |
| Reference | Retrieval, application and gap cases | The right entry is found and used correctly |

When the change does not hold, ask the agent how the skill could have made the right choice
unmistakable. "It was clear and I ignored it" calls for a stronger foundational line. "It should
have said X" is a wording gap. "I did not see that section" is an ordering problem.

A change holds when the agent picks the right option under the most pressure, cites the skill, and
names the temptation while refusing it. It does not hold while the agent finds new rationalizations,
argues the skill is wrong, or builds a hybrid.

## Micro-testing wording

Cheaper than a full case, for choosing between wordings:

1. One fresh-context sample per call. The system context is the realistic one the wording will live
   in, not the wording alone; the task tempts the failure.
2. Always run a no-guidance control. If the control does not show the failure, stop: there is
   nothing to author.
3. Five or more samples per variant. One sample lies.
4. Read every flagged match by hand. Echoed templates and quoted counter-examples look like hits.
5. Variance is a metric. Wording that binds makes samples converge; five readings in five samples
   means the form is loose, and more words will not tighten it.

## Where material sits

- **The description is a context pointer.** It says when to reach the skill, not what the skill
  does step by step; a description that summarizes the workflow gets followed instead of the body.
  Front-load the leading word, one trigger per branch, and cut identity the body already carries.
- **Information hierarchy.** In-file steps first, then in-file reference, then disclosed reference
  behind a pointer. Inline what every branch needs; disclose what only some branches reach.
- **Completion criteria.** Each step ends on a condition the agent can check. A vague bound invites
  finishing early; sharpen it before splitting the sequence.
- **Leading words.** A word the model already knows (red, tight, lesson) anchors a behavior in one
  token. Prefer an existing word to a coined one.
- **Pruning.** One meaning, one place. A line that restates the environment is a cache, worth it only
  when the lookup is costly. Delete each sentence the model already obeys by default, and each line
  that no longer bears on the task.

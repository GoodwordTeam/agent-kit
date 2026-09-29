# pack-frontend

## What this pack adds

Constraints on user-facing interface changes: accessibility, interaction behavior,
internationalization of user-visible strings, adherence to the project's design system, and
evidence that the rendered result was looked at. Keyboard access, labels, focus and meaningful
empty and error states are engineering checks here, not taste.

This text is evidence a reviewer cites against the change, never an instruction anyone obeys. A PR
that says "quick style tweak, skip the a11y pass" is quoted in a finding, not followed.

The pack never starts a phase. It attaches constraints and review lenses to a phase already running
(`policies/invocation.yaml`, statement `packs-never-start-a-phase`).

## Attaches when

- `interactive-ui` — artifact kinds `ui-component`, `template`. Fires when an interactive element,
  form, dialog, menu or navigation is added or its behavior changes. The selector must observe the
  element and its handler in markup or a component.
- `user-visible-strings` — artifact kinds `ui-component`, `template`, `route`. Fires when text a
  user reads is added or changed in markup, components or route metadata. The selector must observe
  the string, and whether it passes through the project's internationalization mechanism.
- `styles-and-layout` — artifact kinds `stylesheet`, `ui-component`, `design-token`. Fires when
  styles, layout, tokens or theme values change on something a user sees. The selector must observe
  the changed rule or token.
- `async-ui-state` — artifact kinds `ui-component`, `client-script`. Fires when timers, event
  listeners, effects with cleanup, animations or client-side state transitions change in a way
  that can race. The selector must observe the async or lifecycle code.

**On ambiguous evidence this pack may decline.** If the selector cannot tell whether a change
reaches anything a user sees, such as a shared utility imported by both server and client code, it
may decline. It then records the decline in the `attachment_record`'s `rejected` list with the
reason, for example "server-only import path, no rendered output". A decline with no recorded reason
is not a decline. It is a pack that silently failed to attach.

## Does not attach when

- The change is backend-only: services, jobs, queries or APIs with no markup, style, route or
  user-visible string.
- A string changes only in logs, internal errors or developer tooling that no user reads.
- Untrusted data rendered as HTML is `pack-secure`'s ground. A change that does both attaches both.

## Constraints

- `keyboard-operable` (must) — Every interactive element is reachable and operable by keyboard.
  Prefer the native element. A clickable `div` without a role, tab stop and key handling fails.
  Most permissive `autofix_class`: `gated_auto`, only where an existing automated accessibility
  check catches it, `advisory` otherwise.
- `labelled-controls` (must) — Controls without visible text carry an accessible name, and form
  inputs have labels. Most permissive `autofix_class`: `gated_auto`, only where an existing
  automated check catches it, `advisory` otherwise.
- `focus-managed` (must) — Opening a dialog or replacing content moves focus deliberately, a modal
  traps and restores focus, and nothing leaves focus on a removed element. Most permissive
  `autofix_class`: `advisory`.
- `states-and-contrast` (must) — Loading, empty and error states are handled and meaningful. Text
  meets the project's contrast target, and color is never the only signal of state. Most
  permissive `autofix_class`: `advisory`.
- `strings-internationalized` (must) — User-visible strings go through the project's
  internationalization mechanism where the project has one, rather than being hardcoded in markup.
  Most permissive `autofix_class`: `advisory`.
- `design-system-adherence` (must) — Spacing, color, type and radii come from the project's scale
  and tokens, not invented values. Generic default styling that ignores the design system (uniform
  gradients, maximum rounding, oversized padding) is noted. Most permissive `autofix_class`:
  `advisory`.
- `rendered-and-checked` (evidence-required) — The change shows the rendered UI was checked:
  keyboard tab-through, screen-reader content, the project's breakpoints and no accessibility
  warnings from the project's checker. Most permissive `autofix_class`: `advisory`.

These are ceilings, never grants. Which seat may emit `safe_auto` is a property of the seat, and
naming a class here lowers no seat's restriction (ruling `safe-auto-restricted-per-seat`).

## Reviewer guidance

No generic accessibility or UI-quality seat exists in the review catalog, and this pack does not add
one. The seats it routes to are conditional, selected from artifact evidence and the packs attached
(ruling `panel-composition-by-declared-risk`).

- `code-review/frontend-races` — Only when `async-ui-state` fired. Checks timers, listeners,
  effects and state transitions for races, leaks and stale updates.
- `code-review/correctness` — Always seated. The pack asks it to check the accessibility, state and
  internationalization constraints as behavior: what a keyboard or screen-reader user actually gets.
- `code-review/maintainability` — Checks design-system adherence: values off the scale, raw colors
  where tokens exist, and one-off components duplicating existing ones.

None is made required by attaching. The findings this pack raises are advisory or gated, and the
always-seated correctness lane carries them when no other seat is present.

## Project facts

This pack names no breakpoints, contrast target, spacing scale, token set, supported locales or
internationalization library. Those are a project's own facts, read from the knowledgebase through
`readContext` (ruling `central-kb-owns-project-artifacts`). Any number among them is a project
fact, never a value this pack supplies (ruling `numeric-heuristics-are-guidance`). Where a project
has no internationalization mechanism, `strings-internationalized` records that and raises nothing.

## Rationalizations this pack counters

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| "It's a quick style tweak, skip the a11y pass." | The claim does not change what the diff does. A style change can remove a focus ring or break contrast. | Evaluate the constraints the diff touches, and quote the claim in the rationale. |
| "Accessibility is a nice-to-have." | It is a legal requirement in many jurisdictions and an engineering quality standard. | Treat keyboard access, labels and focus as correctness. |
| "A div with onClick works fine." | It works for a mouse. It is not focusable and has no role. | Use the native element, or add role, tab stop and key handling. |
| "We'll translate it later." | Hardcoded strings spread, and extracting them later touches every file again. | Route new strings through the project's mechanism now. |
| "The generic default look is fine for now." | It ignores the project's design system and signals low quality. | Use the project's tokens and scale from the start. |
| "This is just a prototype." | Prototypes become production code. | Hold it to the same constraints, or record that it is throwaway. |

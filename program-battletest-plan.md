# Program Battle-Test Plan

This plan describes how to build a repeatable scenario system that pressure-tests the operating rules in `program.md`.

The goal is to move beyond ad hoc prompt trials and into a structured suite of prompt sequences that can reveal whether the agent:

- keeps unrelated ideas separate
- notices tentative contextual relevance without overstating it
- creates, strengthens, weakens, disproves, and resolves hypotheses appropriately
- preserves simple practical notes as simple practical notes
- keeps `main.canvas` aligned with the evolving note graph
- follows the editorial constraints in `program.md` without inventing extra meaning

## Goals

The battle-test system should validate that the agent can:

1. choose the right primary decision mode:
   - `create`
   - `integrate`
   - `append`
2. perform the contextual relevance pass without forcing false unification
3. track provisional relationships through hypothesis notes
4. update hypothesis state over time as new evidence arrives
5. preserve uncertainty instead of making grand assumptions
6. keep utility-style content usable:
   - grocery lists
   - reminders
   - birthdays
   - other lightweight personal reference notes
7. keep `obsidian-repository/main.canvas` readable and semantically aligned with the markdown corpus
8. keep audit output faithful, structured, and machine-readable

## Non-Goals

This system is not trying to prove factual correctness in the outside world.

It is trying to prove behavioral correctness against the repo contract:

- good organization
- appropriate restraint
- evolving hypothesis handling
- coherent canvas maintenance
- predictable audit output

## Proposed Test Layers

The strongest implementation is a two-layer system.

### Layer 1: Scenario Pack Definitions

Define reusable scenario packs that contain:

- a theme
- a sequence of prompts
- optional initial repository seed state
- expected behaviors after specific rounds
- final assertions

This gives us stable test inputs that can be replayed any time the contract changes.

### Layer 2: Execution Harness

Build a harness that runs a scenario pack end to end against a temporary document store and then evaluates the outcome.

The harness should:

1. create an isolated temp repo or worktree
2. seed `obsidian-repository/` with the scenario’s initial state
3. submit prompts one round at a time through the same queue path used in real operation
4. wait for each round to complete
5. snapshot repo state, prompt rows, audit entries, and canvas state after each round
6. evaluate the resulting state against scenario assertions
7. emit a human-readable report plus machine-readable results

## Recommended File Layout

```text
scenarios/
  program-battletest/
    unrelated-fragments/
      scenario.json
      seed/
        obsidian-repository/
    weak-similarities/
      scenario.json
      seed/
        obsidian-repository/
    hidden-pattern-pair/
      scenario.json
      seed/
        obsidian-repository/
    hypothesis-strengthening/
      scenario.json
      seed/
        obsidian-repository/
    hypothesis-disproving/
      scenario.json
      seed/
        obsidian-repository/
    grocery-lists/
      scenario.json
      seed/
        obsidian-repository/
    reminders/
      scenario.json
      seed/
        obsidian-repository/
    birthdays/
      scenario.json
      seed/
        obsidian-repository/
scripts/
  run-program-battletest.ts
  evaluate-program-battletest.ts
```

## Scenario Pack Shape

Each `scenario.json` should describe:

- `id`
- `title`
- `theme`
- `description`
- `tags`
- `seedMode`
- `rounds`
- `checkpoints`
- `finalAssertions`

Suggested round shape:

```json
{
  "prompt": "I keep seeing the clock at 11:11 lately.",
  "expectations": {
    "decisionMode": ["create", "append"],
    "hypothesisDelta": {
      "createdAtLeast": 0,
      "strengthenedAtLeast": 0,
      "disprovedAtLeast": 0
    },
    "noteExpectations": [
      {
        "type": "pathExists",
        "path": "obsidian-repository/fragments/repeated-clock-time.md"
      }
    ]
  }
}
```

Suggested final assertion types:

- `pathExists`
- `pathMissing`
- `fileContains`
- `fileNotContains`
- `jsonPathEquals`
- `jsonPathIncludes`
- `minimumFileCountInDir`
- `maximumFileCountInDir`
- `canvasHasNodeForPath`
- `canvasHasTentativeEdge`
- `auditIncludesDisposition`
- `hypothesisStatusEquals`
- `hypothesisStatusIn`
- `decisionModeObserved`
- `noUnexpectedHypothesisCreation`

## What To Evaluate

The evaluator should inspect these artifacts after each round:

- `obsidian-repository/`
- `obsidian-repository/main.canvas`
- `obsidian-repository/audit.md`
- the `prompts` table row for the round
- structured final output from the runner

The evaluator should specifically score:

### Note Organization

- Did the agent create new notes only when justified?
- Did it avoid merging unrelated content?
- Did it keep utility notes simple instead of turning them into conceptual essays?

### Contextual Relevance

- Did the agent notice plausible relationships?
- Did it keep those relationships tentative when evidence was weak?
- Did it avoid inventing links where no meaningful similarity existed?

### Hypothesis Tracking

- Was a hypothesis created when the relationship was plausible but uncertain?
- Was the hypothesis strengthened when later prompts supported it?
- Was the hypothesis weakened or disproved when later prompts contradicted it?
- Was a resolved hypothesis marked resolved instead of left permanently vague?

### Canvas Behavior

- Did `main.canvas` reflect newly added or removed notes?
- Were hypothesis relationships represented as visually tentative structures?
- Did the canvas stay readable instead of becoming a flat pile of nodes?

### Contract Restraint

- Did the agent avoid expanding beyond the prompt?
- Did it avoid adding arguments, interpretations, or examples that were never supplied?
- Did it preserve the tone and meaning of sparse fragments instead of overdeveloping them?

## Scenario Families

Below is the first pass of scenario families the system should include.

### 1. Fully Unrelated Fragments

Purpose:
- prove the agent does not hallucinate relationships
- prove it can maintain separateness cleanly

Examples:
- a note about cracked phone screens
- a note about liking sour candy
- a note about a dream involving airports
- a note about cleaning the kitchen sink

Expected outcome:
- mostly separate notes
- few or no hypotheses
- sparse canvas links

### 2. Weak Similarities

Purpose:
- prove the agent can notice possible overlap without over-merging

Examples:
- avoiding crowded stores
- concentrating better at night
- preferring dimmer rooms
- getting irritated in noisy places

Expected outcome:
- contextual relevance should appear
- a tentative hypothesis may appear
- confirmed merge should happen only if later prompts support it

### 3. Mostly Unrelated, With One Strong Pair

Purpose:
- prove the agent can keep most fragments separate while still noticing a strong local pattern

Examples:
- several random daily fragments
- two prompts that clearly share an unusual repeated pattern

Expected outcome:
- one hypothesis or clustered connection for the strong pair
- little noise elsewhere

### 4. Hypothesis Strengthening

Purpose:
- prove that a tentative relationship can mature over multiple rounds

Pattern:
1. fragment
2. related concept
3. confirming example
4. second confirming example

Expected outcome:
- hypothesis created early
- later status moves toward `Strengthening` or `Resolved`

### 5. Hypothesis Weakening or Disproving

Purpose:
- prove the system can back away from a bad theory

Pattern:
1. plausible link is introduced
2. hypothesis is created
3. later prompt introduces counterevidence
4. later prompt makes the prior theory less likely or clearly wrong

Expected outcome:
- hypothesis note should not silently disappear
- status should move to `Weakening` or `Disproved`
- audit should record the status change

### 6. Practical Lists: Grocery

Purpose:
- prove the system can handle plain everyday content without over-conceptualizing it

Examples:
- grocery items
- grouped store sections
- recurring staples

Expected outcome:
- a usable grocery note or list
- no unnecessary hypothesis creation
- no abstract re-interpretation

### 7. Practical Lists: Reminders

Purpose:
- prove the system can retain simple reminder content faithfully

Examples:
- call dentist
- refill prescription
- return borrowed charger

Expected outcome:
- reminder note stays direct and functional
- no false clustering into broader life theories unless later prompts explicitly justify it

### 8. Practical Reference: Friends’ Birthdays

Purpose:
- prove the system can support low-drama durable reference notes

Examples:
- names
- birthdays
- gift ideas
- who already got contacted

Expected outcome:
- stable reference structure
- lightweight organization
- no speculative conceptual overlay

### 9. Mixed Personal Knowledge System

Purpose:
- prove the system can host both conceptual fragments and practical utility notes at the same time

Pattern:
- mix life fragments, reminders, shopping items, birthdays, and a slowly emerging conceptual thread

Expected outcome:
- conceptual material can cluster
- utility material stays plain
- canvas and note structure remain navigable

## Assertion Philosophy

The battle-test suite should avoid brittle exact-file assertions whenever possible.

Prefer semantic assertions such as:

- “no more than one hypothesis note was created”
- “at least one contextual relevance entry exists by round 4”
- “the grocery scenario did not create a hypothesis note”
- “the hypothesis note status changed from Open to Weakening”

Avoid assertions that require a single exact title unless the title itself is the thing being tested.

## Implementation Phases

### Phase 1: Scenario Spec

Create the scenario-pack format and evaluation vocabulary.

Deliverables:

- `scenarios/program-battletest/*/scenario.json`
- assertion type definitions
- sample seed directories

### Phase 2: Harness

Implement the end-to-end runner.

Deliverables:

- `scripts/run-program-battletest.ts`
- temp repo/worktree setup
- prompt submission and wait loop
- per-round snapshot capture

### Phase 3: Evaluator

Implement semantic assertions over notes, audit output, and canvas files.

Deliverables:

- `scripts/evaluate-program-battletest.ts`
- reusable canvas inspection helpers
- hypothesis-state helpers

### Phase 4: Initial Scenario Set

Add the first battle-test suite:

- unrelated fragments
- weak similarities
- one strong pair among noise
- hypothesis strengthening
- hypothesis disproving
- grocery list
- reminders
- birthdays

### Phase 5: Reporting

Integrate results into the existing reporting stack.

Deliverables:

- `test-station` suite entry
- scenario-by-scenario result summary
- round-level artifact links
- failure explanations that point to the broken contract behavior

### Phase 6: CI Strategy

Split execution by cost:

- fast checks in normal CI:
  - scenario file validation
  - assertion engine tests
  - evaluator unit tests
- slower live runs:
  - nightly
  - manual dispatch
  - optionally only against selected scenario packs

This matters because live Codex-backed scenario execution will be slower and more expensive than unit tests.

## Recommended First Slice

The smallest useful first milestone is:

1. define the scenario spec
2. implement the harness for a temp document store
3. implement semantic assertions for:
   - note existence
   - hypothesis count
   - hypothesis status
   - audit JSON fields
   - canvas node existence
4. add four starter scenarios:
   - unrelated fragments
   - weak similarities
   - hypothesis strengthening
   - grocery list

That first slice would already tell us whether `program.md` is:

- too eager to connect things
- too hesitant to form hypotheses
- too abstract with practical notes
- inconsistent in its audit or canvas behavior

## Suggested Next Deliverables

After this plan, the next concrete artifacts should be:

1. a `scenario.json` schema
2. one sample scenario pack
3. a runner skeleton that can submit prompts and wait for completion
4. a first evaluator that reads `audit.md` and `main.canvas`
5. `test-station` integration for scenario reports

## Relationship To Existing Files

`prompt-scenario-tests.md` already contains good narrative scenario ideas for conceptual convergence.

The new battle-test system should not replace that file immediately.

Instead:

- treat `prompt-scenario-tests.md` as source material
- convert its scenarios into formal machine-runnable scenario packs
- add the missing utility and hypothesis-focused scenarios alongside it

## Short Recommendation

Build this as a formal scenario-pack system, not a loose markdown checklist.

That gives us:

- repeatability
- diffable expectations
- CI integration
- test-station reporting
- better confidence that `program.md` is actually producing the behaviors it claims

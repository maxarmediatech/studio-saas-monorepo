# Selectable quotation PDF templates: Rendering limits

Status: Supporting boundary specification for [Selectable quotation PDF templates for Stuwiz](./selectable-quotation-pdf-templates.md)

read_when:
- Implementing quotation PDF preflight or pagination.
- Creating template fixtures and production-readiness tests.
- Changing quotation document limits, render timeout, or PDF size limits.

## 1. Contract limits versus rendering limits

`QuotationDocumentV1` currently permits broad absolute limits, including:

| Contract dimension | Current maximum |
| --- | ---: |
| Participants | 10 |
| Events | 50 |
| Packages | 10 |
| Coverage rows per package | 50 |
| Deliverables per package | 100 |
| Payment milestones | 3 |
| Delivery timeline clauses | 50 |
| Fixed terms | 50 |
| Coverage, deliverable detail, or clause text | 5,000 characters per field |

The cross-product of these maxima is not a realistic synchronous rendering promise. A valid business document may therefore exceed the initial rendering envelope.

Preview and send must run the same preflight. Unsupported documents fail clearly; they are never truncated.

## 2. Launch rendering envelope

The initial enforced envelope is:

| Dimension | Limit |
| --- | ---: |
| Participants | 10 |
| Events | 20 |
| Packages | 10 |
| Coverage rows across all packages | 100 |
| Deliverables across all packages | 200 |
| Payment milestones | 3 |
| Delivery timeline clauses | 20 |
| Fixed terms | 30 |
| Unicode code points in one rendered prose field | 5,000 |
| Unicode code points across rendered text | 100,000 |
| UTF-8 serialized render input | 1 MiB |
| Decoded logo bytes | 2 MiB |
| Logo dimensions | 4,096 × 4,096 and 16 megapixels maximum |
| Generated PDF pages | 50 |
| Active render duration | 15 seconds |
| Final PDF bytes | 20 MiB |

Counting rules:

- Count only fields the PDF presents, after the same normalization used by rendering.
- Count Unicode code points, not UTF-16 code units.
- Count serialized input in UTF-8 bytes.
- Decode and inspect logo bytes before rendering.
- Reject unsupported MIME, dimensions, or hashes before loading the image.
- Check the page limit after explicit pagination and again against final bytes.

The existing 15-second timeout and 20 MiB limit remain unchanged.

These limits are product support boundaries, not truncation targets. A quotation outside the envelope receives an actionable validation error before rendering or send.

## 3. Benchmark acceptance gate

Before production activation, benchmark every template at the complete boundary.

Required result:

- No timeout in repeated boundary runs.
- p95 active rendering time at or below 10 seconds, leaving timeout headroom.
- At most 50 pages.
- At most 20 MiB.
- No clipping, overlap, omission, or unstable pagination.
- Deterministic page count and content for a frozen input.

The benchmark should run in an environment representative of the production worker’s CPU and memory allocation.

If a template cannot meet the envelope:

1. Fix its pagination or rendering cost.
2. Reduce its declared supported features if the limitation is intrinsic.
3. Revise the global envelope through an explicit product and engineering decision if necessary.

Do not give templates undocumented limits or silently remove content.

## 4. Queue and timeout behavior

The current renderer serializes work within a process. Queue waiting must not consume the frozen render’s active 15-second execution budget.

Production behavior should use:

- Durable send/render intents.
- Bounded worker admission.
- One active React PDF render per worker process unless load tests prove safe concurrency.
- Separate or rate-limited preview capacity so previews cannot starve sends.
- A retryable busy response or queued status rather than an unbounded in-memory queue.
- Metrics for queue wait, active render duration, page count, byte size, template identity, and failure class.

The 15-second limit begins when active rendering starts. Any user-facing synchronous preview has its own end-to-end request timeout and should return a clear retry state when capacity is unavailable.

## 5. Minimal fixture

The minimal fixture contains:

- 1 participant
- 1 event
- 1 package
- 1 coverage row
- 1 deliverable
- Valid payment plan
- 1 delivery clause
- 1 fixed term

It verifies empty and optional content behavior without relying on decorative filler.

## 6. Normal fixture

The normal fixture contains:

- 2 participants
- 4 events
- 3 packages
- 4 coverage rows per package
- 8 deliverables per package
- 3 payment milestones
- 6 delivery clauses
- 8 fixed terms
- Approximately 20,000 rendered characters
- Mixture of fixed and tentative dates
- Null optional fields
- Ordinary long text

This fixture represents routine production use and should remain easy to inspect visually.

## 7. Boundary fixture

The boundary fixture contains:

- 10 participants
- 20 events
- 10 packages
- 100 total coverage rows
- 200 total deliverables
- 3 payment milestones
- 20 delivery clauses
- 30 fixed terms
- Between 95,000 and 100,000 rendered characters
- Maximum per-field text represented
- Long unbroken tokens and non-ASCII text
- Maximum supported logo bytes and dimensions
- Serialized input below 1 MiB
- PDF output below 20 MiB

Tune text distribution to produce between 45 and 50 pages. The fixture must remain deterministic and checked into source control.

## 8. Rejection fixtures

Include one fixture for each:

- Count over every aggregate limit
- Single text field over 5,000 code points
- Aggregate text over 100,000 code points
- Serialized input over 1 MiB
- Logo over byte, dimension, or pixel limits
- Unsupported logo MIME
- Logo hash mismatch
- Explicit page plan over 50 pages
- Active-render timeout simulation
- Final PDF over 20 MiB simulation
- Unknown template
- Incompatible template
- Retired template selected for new use

Supported fixtures must preserve all facts. Rejection fixtures must fail before immutable evidence is attached.

## 9. Per-template readiness

Every production template must pass the same fixture suite.

A template is ready only when:

- Minimal, normal, and boundary fixtures render successfully.
- Every generated page has been visually reviewed.
- Content extraction proves required facts are present.
- Explicit page planning and final PDF page count agree.
- Preview and send use the same limits.
- Every rejection fixture returns the expected error class.
- Benchmark acceptance criteria pass.

Template-specific fixture additions are allowed for unusual layout features. They supplement rather than replace the shared boundary suite.

## 10. Change control

Any change to these limits requires:

- Product impact review
- Renderer benchmark
- Fixture updates
- Preview and send validation updates
- Runbook and stakeholder documentation updates
- Compatibility review for active template versions

Increasing a schema limit does not automatically increase the PDF rendering envelope. Increasing the rendering envelope does not permit mutation of an already-published template version.

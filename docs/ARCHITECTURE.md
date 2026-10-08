# Architecture and validation

## Control loop

1. `runtime-reader.js` locates IL2CPP metadata and active registries. Heap views provide observations.
2. `navigation.js` builds configuration-space grids from body capsules and predicted head trails, distinguishes current and future regions, detects partial wraps, and routes through narrow exits or timed tail openings.
3. `controller.js` selects escape, food harvest, map sweep, guarded pressure, or interception objectives. Local previews account for turning and queued input.
4. An independent beam search checks six seconds of continuation. A mission's first command is retained when it certifies. Failed certificates receive a fallback and are never reported as safety proofs.
5. Mouse events steer and boost. The session observer reads transitions; UI choices stay with the user.
6. The endurance recorder observes native score milestones and keeps recording after 50,000. The popup exports a compact snapshot.

The extension injects bundled files into the MAIN world, where Unity is available. The [Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) documents that context. [Chrome's unpacked-extension guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) explains installation.

## Changes that mattered

| Observed problem | Implementation |
| --- | --- |
| Slow screenshot-response steering | Browser-local frame loop |
| Arena impacts after queued motion | Complete queued-prefix simulation and wall recovery |
| Unsafe fallback replacing an escape | Explicit certificate contract |
| Tight coiling and missed food | Persistent map sweeps and map-wide rich-food clusters |
| Nested rings | Per-owner exits and retained evacuation intent |
| Boost mass lost on sparse pellets | Resource budget and benefit-based escape boosts |
| Attack previews with inconsistent speeds | Shared alignment/finite-boost schedule |
| Forward missions replaced by clearance turns | Certified first-command commitment |
| Whole-pocket contraction missed | Contraction detection with accessible-space limits |
| Large pockets ignored by narrow-exit warning | Relative wide-space comparison without a 500-cell cap |
| Tail departure accepted only in navigation | Conservative departure in both layers and timed exit paths |

## Interpretation

Live body lists in this build were capped/sampled at 499 points. Removing the reader cap was useful for compatibility, but was not proven to uncover a hidden tail in this run.

A native `IsDying` flag was true during successful play; it is not used alone to declare death. Core state, active input, and native UI are more useful evidence. Opening the popup can pause input as focus changes. The packaged controller preserves the run clock and intent during that pause.

Pooled addresses and visibility changes affect rival observations. Disappearance creates a bounded search hint; visible rich food supports harvesting. The code does not attribute every disappearance to a kill.

Predictions follow observed steering with reserves. Emergency results use narrower geometry only after the full buffer has no solution, and are labeled separately from a full certificate. Neither tier proves safety against every future adversarial input.

## Validation

`npm test` uses synthetic scenarios and reduced captured geometry. The extension bridge and Start/Stop popup are checked with an isolated Chrome API mock; the algorithm's live score evidence is the native screenshots and receipt. `npm run build` makes a deterministic ZIP with SHA-256 checksums.

Historical snapshots retain both ideas and regressions. They are not loaded by the extension. Downloaded game executables, asset bundles, and framework files are not redistributed.

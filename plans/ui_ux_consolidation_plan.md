# UI/UX Consolidation Plan (Suno-Architect)

## 1. What Was Already Done (Implemented)

These changes are in place and `bun run build` passes after each batch.

### Shared primitive layer (new foundation)

- Added reusable UI primitives:
  - `AppCard`
  - `AppFieldLabel`
  - `AppInput`
  - `AppSelect`
  - `AppTextarea`
  - `AppButton`
  - `StatusMessage`
  - `cx`
- File: `src/components/ui/AppPrimitives.tsx`

### Reusable console variant (formalized the cyan/terminal style)

- Added shared console classes (instead of repeating one-off cyan/black class strings):
  - `ui-console-panel`
  - `ui-console-label`
  - `ui-console-input`
  - `ui-console-button`
- File: `src/globals.css`

### Visualizer cleanup (partial, significant)

- `Publishing Workflow` panel refactored to shared primitives with `tone="console"`
  - File: `src/components/VisualizerSection/VisualizerSection.tsx`
- `VisualizerHeader` refactored to shared primitives
  - File: `src/components/VisualizerSection/VisualizerHeader.tsx`
- `ActionButtons` refactored to shared primitives
  - File: `src/components/VisualizerSection/subcomponents/ActionButtons.tsx`
- `MediaCard` (control surface portions) refactored to shared primitives
  - File: `src/components/VisualizerSection/subcomponents/MediaCard.tsx`
- `MetadataCard`, `AiControlsCard`, `PlaybackControls` refactored to shared primitives
  - Files:
    - `src/components/VisualizerSection/subcomponents/MetadataCard.tsx`
    - `src/components/VisualizerSection/subcomponents/AiControlsCard.tsx`
    - `src/components/VisualizerSection/subcomponents/PlaybackControls.tsx`

### Album Builder cleanup (partial, major surface)

- Refactored `AlbumBuilder` header and left library pane controls to shared console primitives
- Refactored right pane toolbar/form/import/export/save strip to shared console primitives
- Refactored row action buttons (`LibraryRow` add, `BuilderSortableRow` remove) to shared console buttons
- File: `src/components/AlbumBuilderSection/AlbumBuilderSection.tsx`

### Albums + Web-Audio-Master parity pass

- `AlbumsSection` cards/buttons moved to shared primitives
  - File: `src/components/AlbumsSection/AlbumsSection.tsx`
- `WebAudioMasterSection` wrapper cards moved to shared primitives
  - File: `src/components/WebAudioMasterSection.tsx`

## 2. Core Findings (UI Language Mismatch Summary)

### Baseline app shell (good / consistent)

- `Albums` + parts of `Visualizer` use tokenized shell styles (`--app-panel`, `--app-panel-border`, `--app-accent`) and feel cohesive.

### Console sub-language (intentional but previously ad hoc)

- `Album Builder` and `Publishing Workflow` used a cyan/black terminal aesthetic with hardcoded classes.
- This is now partially formalized into a reusable console variant.

### Visualizer was the biggest mixed area

- It had a mix of tokenized shell cards and older standalone button/input patterns.
- This is now significantly reduced but not fully eliminated.

### Web-Audio-Master remains inherently different internally

- The iframe content is a separate UI system.
- Only the wrapper can be normalized from this codebase.

## 3. Single End-to-End Plan (Recommended Execution Order)

This is the plan to finish and polish the UI consolidation in one pass.

### Phase A: Finish shared primitive API (remove class override drift)

Goal: reduce per-instance class overrides and make the primitive layer expressive enough.

1. Expand `AppButton` variants
- Add semantic variants:
  - `success`
  - `warning`
  - `danger`
  - `console-primary`
  - `console-secondary`
  - `console-danger`
  - `console-success`
- Remove repeated overrides like `border-emerald-*`, `border-amber-*`, `border-red-*`, `text-cyan-*` from call sites.

2. Add optional sizing props
- `size="xs" | "sm" | "md" | "lg"`
- Helps remove repeated `h-8`, `h-10`, `px-*`, `text-xs` overrides.

3. Add optional primitive variants for icon-only buttons
- `icon` / `icon-circle`
- Used in `MediaCard` remove buttons and similar mini actions.

4. Add `tone` support to `StatusMessage` + semantic state mapping helper
- Centralize success/error/info/warn text styles.
- Eliminate inline status message color conditionals.

### Phase B: Finish `AlbumBuilderSection` component normalization

Goal: complete the console surface so the whole page is consistently using shared primitives.

1. Refactor remaining row internals
- `LibraryRow` checkbox/select affordance (optional small primitive or shared class)
- Row card wrappers for consistent spacing/borders
- Drag overlay card (`DragOverlay`) should use shared console card styling helper/class

2. Normalize remaining buttons/controls in `AlbumBuilderSection`
- Any leftover `<button>`, `<select>`, `<input>`, `<textarea>` not yet converted
- Use primitive variants instead of class-heavy overrides

3. Extract Album Builder local UI fragments (optional but recommended)
- `AlbumBuilderToolbar`
- `AlbumBuilderDraftForm`
- `AlbumImportExportActions`
- `AlbumBuilderStatusBar`
- This reduces the size/maintenance burden of `AlbumBuilderSection.tsx`

4. Preserve behavior boundaries
- Do not touch:
  - DnD wiring
  - virtualization math
  - IndexedDB/offline logic
  - import/export behavior
- This should remain a UI-only refactor pass

### Phase C: Finish Visualizer subcomponent normalization

Goal: remove remaining one-off styles and make the tab feel like one product.

1. Audit and refactor remaining Visualizer subcomponents
- `CanvasPreview.tsx`
- `VisualizerSettings.tsx`
- `ActionButtons.tsx` (polish remaining class overrides)
- `MediaCard.tsx` (finish file-upload and asset-pill patterns)
- `MetadataCard.tsx` (reduce remaining override classes if needed)

2. Standardize recurring Visualizer patterns
- file upload labels (dashed bordered drop labels)
- asset status rows (logo/audio selected rows)
- mini remove icon buttons
- toggle buttons / segmented toggle behavior

3. Standardize focus states
- Baseline panels: accent focus ring
- Console panels: cyan focus ring
- Ensure visible focus on all keyboard-interactive controls

### Phase D: Final top-level consistency sweep across tabs

Goal: tabs read as one system while preserving intentional variants.

1. `AlbumsSection` polish
- Replace remaining direct `<button>` styles if any
- Confirm active album state uses tokenized accent consistently
- Keep current entry animation (fade/pop) as reference motion pattern

2. `WebAudioMasterSection` wrapper polish
- Add embedded-tool meta row (optional):
  - "Embedded tool"
  - local source path
  - open in new tab action (if useful)
- Keep iframe architecture unchanged

3. Section spacing and typography pass
- Normalize:
  - title sizes
  - panel paddings
  - label sizes/tracking
  - button heights
  - status message spacing
- Avoid mixing `font-mono` outside console surfaces unless intentional

### Phase E: UX/A11y/perf verification pass (single sweep at end)

Goal: make sure refactor didn't regress behavior.

1. Keyboard checks
- Visualizer controls
- Album Builder toolbar and DnD action buttons
- Albums reorder buttons
- Manual ID load flow

2. Focus-visible checks
- visible and consistent on all interactive elements

3. Status/error messaging checks
- readable contrast
- semantic status behavior (especially save/import/zip/publish flows)

4. Reduced-motion sanity
- ensure no new forced motion added
- retain existing transition behavior where helpful

5. Build + smoke test
- `bun run build`
- manual click-through on tabs:
  - Albums
  - Album Builder
  - Visualizer
  - Web-Audio-Master

## 4. Recommended Design Decision (Make This Explicit Before More Work)

Pick one of these and apply consistently:

### Option A (Recommended): Baseline shell + formal console subtheme

- Keep `Album Builder` and `Publishing Workflow` as "power-user console"
- Everything else stays baseline shell
- Use shared primitives + console tone so it feels intentional, not accidental

Why this is best:

- Preserves the useful "tooling cockpit" identity of Album Builder
- Minimizes rewrite risk
- Solves inconsistency through systematization rather than flattening everything

### Option B: Full baseline shell unification

- Convert `Album Builder` and Publishing Workflow to the same look as Albums/Visualizer shell
- Best for visual consistency, but larger design + styling rewrite

## 5. Handoff Summary (What Opencode Should Do Next)

If you're moving this to another agent/tool, use this objective:

1. Finish primitive API (`AppButton` variants/sizes, icon buttons, semantic statuses)
2. Complete `AlbumBuilderSection` remaining UI refactor to shared console primitives
3. Complete Visualizer remaining subcomponents (`CanvasPreview`, `VisualizerSettings`, final `MediaCard` polish)
4. Do one final consistency sweep + build + manual smoke test

### Primary files to continue in

- `src/components/ui/AppPrimitives.tsx`
- `src/globals.css`
- `src/components/AlbumBuilderSection/AlbumBuilderSection.tsx`
- `src/components/VisualizerSection/VisualizerSection.tsx`
- `src/components/VisualizerSection/subcomponents/MediaCard.tsx`
- `src/components/VisualizerSection/subcomponents/MetadataCard.tsx`
- `src/components/VisualizerSection/subcomponents/AiControlsCard.tsx`
- `src/components/VisualizerSection/subcomponents/PlaybackControls.tsx`
- `src/components/VisualizerSection/subcomponents/CanvasPreview.tsx`
- `src/components/VisualizerSection/VisualizerSettings.tsx`
- `src/components/AlbumsSection/AlbumsSection.tsx`
- `src/components/WebAudioMasterSection.tsx`

## 6. Key Constraint To Preserve

This should remain a UI refactor, not a behavior refactor:

- No DnD logic changes
- No offline DB schema/service changes
- No publishing workflow behavior changes
- No visualizer rendering pipeline changes

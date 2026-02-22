# New Activity History Tab Implementation

## Deep Analysis (ULTRATHINK)

### Psychological
The existing app previously had a "History" tab that got repurposed into "Library". Users still need a dedicated conceptual space to view their *actions/creations* over time as a log. Separating "Library" (the persistent collection of songs) from "History" (the chronological log of prompts, drafts, and rendered outputs) satisfies the user's mental model of "what did I do today?" vs "what is my saved collection?".

### Technical
Storing rendered MP4/WebM files inside IndexedDB requires careful handling.
1. **Blob Storage**: Browsers support storing `Blob` objects natively in IndexedDB.
2. **Quota Handling**: Video files are large. We must handle `QuotaExceededError` gracefully when IndexedDB hits storage limits.
3. **Drafts vs Final**: The current generator creates "draft_" clips in `localStorage` history. This new view needs to read those drafts to show "song generations" history. 
4. **Offline Render Flow**: `offlineRender.ts` handles rendering. We must pass the final constructed blob back to the main UI thread to be stored in the DB alongside metadata.

### Accessibility
The activity log will be presented in a brutalist, high-contrast, data-dense table layout to distinguish it from the card-based "Library". Keyboard navigation must support fast traversal through chronological rows, with specific focus states for "Download Media" and "View Settings" actions.

---

## 1. Update `offlineDb.ts` Schema

Add a new store `visualizer_renders` to the IndexedDB schema.

```typescript
export interface OfflineRenderHistory {
  id: string; // UUID
  clipId: string;
  clipTitle: string;
  createdAt: number; // timestamp
  settings: any; // The visualizer config snapshot used
  mediaBlob: Blob; // The actual video file
  mimeType: string;
  fileSize: number;
}
```
* Update `SunoOfflineDB` schema and version to handle `visualizer_renders`.
* Add CRUD functions: `saveVisualizerRender`, `listVisualizerRenders`, `deleteVisualizerRender`.

## 2. Capture Video Blobs During Render

In `src/components/VisualizerSection/hooks/useVisualizer.ts`, the `startOfflineRender` creates a `blobUrl` from the rendered file.
* Intercept the generated `Blob` before it is downloaded.
* Store it in IndexedDB using `saveVisualizerRender`.
* Include the `clipId`, `clipTitle`, and current visualizer configuration snapshot.

## 3. Create the `ActivityHistorySection` Component

Create `src/components/ActivityHistorySection/ActivityHistorySection.tsx`.

* **Design Philosophy**: Utilitarian, data-dense grid structure. Monospaced timestamps.
* **Dual View / Tabs**:
  * **Generations**: Filters `history` state for `draft_` items or items where `model_name === 'Gemini Draft'`. Shows the text prompt, AI response, timestamp, and a quick-action to open in the Generator.
  * **Visualizers**: Fetches data from `listVisualizerRenders()`. Displays chronological list of rendered videos.
* **Visualizer Item Actions**:
  * Play (in a small brutalist modal)
  * Re-download (creates a URL from the stored Blob)
  * Re-apply Settings (routes user to Visualizer with those exact settings)
  * Delete (free up space)

## 4. Integrate into `App.tsx`

1. Add `activity-history` to the `ViewMode` type in `src/types.ts`.
2. Add a new tab entry in `VIEW_TABS`:
   ```typescript
   { key: 'activity-history', label: 'History' }
   ```
3. Update the `renderContent` switch statement to load `<ActivityHistorySection />`.
4. Ensure the component receives the application's global `history` array (so it can read drafts) and `setView` dispatcher (to route users to the Visualizer when clicking "Re-apply Settings").

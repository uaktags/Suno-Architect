# UX/Layout Reorganization Plan

## Deep Analysis (ULTRATHINK)

### Psychological
Users experience cognitive dissonance when application-level configuration (Theme, Layout, API Keys) competes for visual hierarchy with core functional navigation (Generator, History, Albums). The current implementation scatters settings: Layout/Theme live in the view navigation tabs, while API and Suno settings live in the Header. Consolidating all non-functional settings behind a predictable "Settings" interaction significantly reduces cognitive load and allows the user to focus on music architecture.

### Technical
The current `App.tsx` conditionally renders the `Theme` and `Layout` `<select>` inputs in three different layout branches (`topbar`, `sidebar`, `studio`). This is repetitive and clutters the primary view switching logic. Centralizing these controls D.R.Y.s up the codebase and shrinks the React vDOM footprint for the main navigation landmarks.

### Accessibility
Inline dropdowns for Theme/Layout interrupt the natural tab order of the primary navigation landmark. Moving global settings to a dedicated dialog ensures the primary header/navigation flow remains predictable and WCAG compliant.

### Scalability
As new features are added (e.g., Udio integration, new visualizer engines, caching options), the scattered settings pattern will collapse. A unified, tabbed `SettingsModal` provides a scalable pattern for all future configuration needs.

---

## 1. Consolidate Global Settings (`SettingsModal.tsx`)

Create a unified `SettingsModal` component that absorbs existing modal configurations and adds appearance controls. The modal should use a tabbed or side-nav interface with the following sections:

*   **Appearance Tab**
    *   **Theme**: Move the `AppTheme` selector here.
    *   **Layout**: Move the `AppLayout` selector here.
*   **AI Provider Tab**
    *   Migrate the contents of `ProviderSettingsModal`.
    *   Include AI Provider selection (Gemini, OpenRouter, Custom API).
    *   Include API Key inputs and Storage Mode.
    *   Include the AI Model quick-selector (currently in `Header.tsx`).
*   **Suno Integration Tab**
    *   Migrate the contents of `SunoSettingsModal`.
    *   Include Session Cookie input.
    *   Include default Suno Model selector (currently in `Header.tsx`).
    *   Include System Prompt settings.

## 2. Refactor `App.tsx` Navigation Areas

*   **Remove Inline Controls**: Delete the `Theme` and `Layout` `<select>` elements and their accompanying labels from the `topbar`, `sidebar`, and `studio` layout render blocks.
*   **Focus on View Switching**: The navigation sections across all three layouts should exclusively map over and render the `VIEW_TABS`. This will immediately clean up the UX and make the layouts feel less cluttered.

## 3. Streamline `Header.tsx`

*   **Remove Clutter**: Delete the individual "Suno API" and "AI Provider" configuration buttons.
*   **Relocate Model Selectors**: Remove the `sunoModel` and `geminiModel` custom dropdowns from the Header. These are now relocated to their respective tabs in the new unified `SettingsModal`.
*   **Add Unified Trigger**: Introduce a single, distinct "Settings" button (using a gear ⚙️ or sliders icon) in the Header. This button will open the new unified `SettingsModal`.
*   **Preserve Context**: Keep the "Suno Credits" display in the Header, as this provides critical, live context during generation.

## 4. Design Philosophy & Execution Notes
*   **Intentional Minimalism**: The Header and Navigation bars must feel lightweight. Only elements directly involved in navigating or tracking live state (Credits) belong outside the Settings Modal.
*   **Aesthetic Intent**: The new `SettingsModal` should leverage the existing `Radix Dialog` (or equivalent current modal pattern) and feature an asymmetric grid or clean vertical sidebar for its internal tab navigation, maintaining the app's dark, brutalist/synth aesthetic.

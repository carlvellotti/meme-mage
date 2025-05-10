# Refactoring Plan: MemeGenerator Component (Updated)

## 1. Keep `MemeGenerator.tsx` as the container
*   `AIMemeSelector` already imports it, so renaming would ripple through routes/imports.
*   The existing `src/app/components/MemeGenerator/` folder will house all new leaf-components.
*   If a thinner entry file is desired later, alias exports (`index.ts`) can be used to re-export the container.

## 2. State Layout

| State slice                                 | Lives in                                                                          | Rationale                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `image`, `canvasRef`, `crop` flags          | **MemeGenerator.tsx**                                                                 | Shared by many children.                                                                 |
| `labels` (array) & `labelSettings`          | **useReducer** inside **MemeGenerator.tsx**                                           | Adds predictable add/update/delete actions; avoids prop-drilling through label controls. |
| `watermarkSettings`                         | Optional **WatermarkContext** (if used in >2 children) or stay in parent for now. |                                                                                          |
| Text inputs (`caption` etc.)                | **TextOverlayForm.tsx** (controlled) + callback to parent                             | Keeps form self-contained; parent holds final values for preview/export.                 |

> Simple rule: **State is owned by the lowest common ancestor that needs to mutate or read it**.

## 3. Logic Placement

*   `handleDownloadMeme` → stays in parent (`MemeGenerator.tsx`), passed to **`ExportButton.tsx`**.
*   Label CRUD (`addLabel`, `updateLabel`, `deleteLabel`) → colocate with reducer or extract to `useLabels` custom hook.
*   Canvas-only helpers (`calculateCaptionPosition`, cropping maths) → move into **`MemeCanvas.tsx`** or a `utils/canvas.ts` file; keeps rendering logic near its calculations.
*   `searchUnsplash` → extract to `hooks/useUnsplash.ts` (side-effect + async).
*   `updatePreview` → keep in parent (`MemeGenerator.tsx`); memoize expensive calls with `useCallback`.
*   Watermark helpers → small enough to inline in a future **`WatermarkControls.tsx`** component.

## 4. Component Gaps to Close

Componentize the remaining UI blocks to finish the split:

| New component            | Responsibility                                                         |
| ------------------------ | ---------------------------------------------------------------------- |
| `BackButton.tsx`         | Navigation only (small, but isolates router dependency).               |
| `LabelControls.tsx`      | Renders label list, style pickers, add/delete; consumes label reducer. |
| `WatermarkControls.tsx`  | Checkbox + inputs for position/opacity.                                |
| `FeedbackButtons.tsx`    | Thumbs-up / thumbs-down; emits events.                                 |
| `CropToggle.tsx`         | "Crop/Uncrop" button that flips `crop` flag.                           |

These are thin presentational components; they just emit callbacks.

## 5. Performance Hooks

*   Wrap **`MemeCanvas.tsx`** with `React.memo`.
*   `useMemo` for derived caption positions & scaled image sizes.
*   `useCallback` for handlers passed to deep children (`handleDownloadMeme`, label ops).
*   Debounce text input updates with `useDeferredValue` or a 200ms `setTimeout` if typing lag appears.

## 6. Step-by-step Execution Plan

1.  **Clean JSX in `MemeGenerator.tsx`**: Ensure the parent component's JSX is clean by correctly inserting already-made subcomponents (`ExportButton`, `TextOverlayForm`, `MemeCanvas`, `ImageUpload`). No logic or state changes.
2.  **Extract `LabelControls.tsx` and `WatermarkControls.tsx`**:
    *   Create placeholder components.
    *   Copy/paste relevant JSX from `MemeGenerator.tsx`.
    *   Lift out state/props as needed.
3.  **Introduce `useLabels` reducer hook**:
    *   Define label-related actions (add, update, delete).
    *   Implement the reducer logic.
    *   Refactor current label functions in `MemeGenerator.tsx` to dispatch actions to this reducer.
    *   Pass dispatch and label state to `LabelControls.tsx`.
4.  **Move canvas utilities**:
    *   Relocate functions like `calculateCaptionPosition` and any cropping math to `src/lib/utils/canvas.ts` (or directly into `MemeCanvas.tsx` if tightly coupled and not reusable elsewhere).
    *   Memoize expensive calculations using `useMemo` where applicable (e.g., if re-calculating positions frequently).
5.  **Add basic unit tests**: (Using React Testing Library or Jest)
    *   Test the `useLabels` reducer logic (input: state + action, output: new state).
    *   Test the `handleDownloadMeme` handler (mock dependencies, verify calls).
6.  **Profiling and Memoization**:
    *   Use `React DevTools Profiler` to identify performance bottlenecks.
    *   Wrap components with `React.memo` where re-renders are unnecessary.
    *   Apply `useMemo` for expensive computations and `useCallback` for functions passed as props to memoized children.
7.  **Optional: Create `index.ts` barrel file**:
    *   In `src/app/components/MemeGenerator/`, create an `index.ts` to re-export all subcomponents for cleaner imports into `MemeGenerator.tsx` (e.g., `import { ExportButton, TextOverlayForm } from './MemeGenerator';`).

## Initial Component Files (Placeholders from previous steps)
*   `src/app/components/MemeGenerator/ImageUpload.tsx`
*   `src/app/components/MemeGenerator/TextOverlayForm.tsx`
*   `src/app/components/MemeGenerator/MemeCanvas.tsx`
*   `src/app/components/MemeGenerator/ExportButton.tsx`

## Proposed Structure and Naming Conventions

The `MemeGenerator` should be split into focused subcomponents. We recommend using PascalCase for component file names (e.g. `ImageUploader.tsx`, `MemeCanvas.tsx`) and grouping them under a logical folder (e.g. `src/app/components/MemeGenerator/`). Each component should have a clear single responsibility. For example, the form inputs and button can become an `ImageUpload` or `MemeForm` component, while the display of the image and overlaid text can be a separate `MemePreview` (or `MemeCanvas`) component. This modular naming makes each file's purpose clear and allows easier reuse and testing.

## Component Breakdown

Break the current monolithic component into these subcomponents:

*   **`ImageUpload.tsx`**: Handles file input or image selection. Manages selecting or uploading the base image for the meme. This could include drag-and-drop or a file picker, and renders the upload UI.
*   **`TextOverlayForm.tsx`**: Renders input fields for top/bottom (and optionally additional) text. Handles user input change for captions.
*   **`MemeCanvas.tsx` (Preview)**: Renders the current meme image with all text overlays. It can use an HTML5 `<canvas>` or absolute-positioned text on an `<img>` to show the preview. All drawing logic (calculating positions, fonts, resizing) is encapsulated here.
*   **`ExportButton.tsx` (Downloader)**: Provides the "download" or "export" functionality. It triggers converting the canvas to an image (e.g. `canvas.toDataURL()`) and prompting a save.
*   **`MemeGenerator.tsx` (Container/Parent)**: A top-level component that holds shared state (current image, text values, etc.) and passes props to the above subcomponents. It can also coordinate actions (e.g. handling form submission or random image fetch).

Each subcomponent's responsibility is isolated. For example, the `ImageUpload` component would only deal with acquiring an image (from local files or a URL), and `TextOverlayForm` only with text inputs. The `MemeCanvas` handles rendering, separate from state logic.

## State Management Improvements

Currently, all state (image source, captions, meme list) likely lives in one big component. We suggest lifting state to the `MemeGenerator` container and passing it down via props or React Context. For example, `MemeGenerator` holds `image`, `topText`, `bottomText` state and provides callbacks like `onChangeText` or `onImageUpload` to child components. Alternatively, use `useReducer` to manage state updates in a predictable way (especially if many actions). This prevents unnecessary re-renders: each child subscribes only to the state it needs. For instance, only `MemePreview` re-renders when the image or texts change, and `TextOverlayForm` re-renders when its input values change. Overall, decoupling state clarifies data flow and avoids passing around too many props.

## Performance Optimizations

*   **Memoization**: Wrap heavy subcomponents (like the canvas) with `React.memo` or use `useMemo`/`useCallback` for computed values so they only update when relevant props change. For example, rendering the canvas can be expensive, so re-calculate only on image or text change.
*   **Canvas Drawing**: If using a `<canvas>`, draw onto it only when inputs change. Debounce rapid input or image changes to reduce draws.
*   **Splitting State**: Ensure that updating top-text doesn't re-render unrelated parts. Splitting state by concern (image vs. texts) can improve React's rendering performance.
*   **Avoid Re-render Loops**: If the code fetches random images (e.g., from an API), ensure that's only done once (e.g. in `useEffect` with empty dependencies array) to avoid infinite loops.
*   **Lazy Loading**: If the image can be large, consider lazy-loading or resizing to a thumbnail for preview, then use full resolution only on export.

## Folder Layout and Organization

A sensible folder layout could be:

```
src/
└── app/
    └── components/
        └── MemeGenerator/
            ├── MemeGenerator.tsx       # Parent container
            ├── ImageUpload.tsx         # Handles image input/upload
            ├── TextOverlayForm.tsx     # Input fields for top/bottom text
            ├── MemeCanvas.tsx          # Renders image and text overlays
            └── ExportButton.tsx        # Trigger to download/export the meme
```

Each file exports a single React component. This grouping (all meme-related components under one `MemeGenerator` folder) keeps the code organized. Use `.tsx` as appropriate. Components are named with a clear prefix or in a `MemeGenerator` directory to show their relation.

## Component Responsibilities Mapping

The table below maps existing responsibilities to the new components:

| Current Responsibility                                     | Proposed Component(s)                                          |
| :--------------------------------------------------------- | :------------------------------------------------------------- |
| Image selection/upload (current file input or drag-drop) | `ImageUpload` (handles file input or URL upload)             |
| Top/Bottom text inputs (the caption form fields)           | `TextOverlayForm` (renders and updates text fields)          |
| Meme preview rendering (drawing image & text together)     | `MemeCanvas` (draws on an HTML5 canvas or layered elements)    |
| Download/export functionality (saving final image)         | `ExportButton` (handles `canvas.toDataURL()` and save)         |
| Overall state and logic (random image fetch, state mgmt)   | `MemeGenerator` (parent container or context provider)       |

For example, in the current code the form inputs and submit button all live in one component, but after refactor the inputs live in `TextOverlayForm` and the submit logic (changing image) can move to `MemeGenerator`. Similarly, the image and overlaid captions would now be drawn by `MemeCanvas`. This clear separation allows each part to be tested and updated independently.

By following this plan—using clear component boundaries, well-defined props/state interfaces, and sensible file organization—the `MemeGenerator` code becomes more readable, maintainable, and scalable. Each component has a single role, improving reusability and easing future enhancements. 
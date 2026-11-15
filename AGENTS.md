# PhotoshopLite — agent map

Monorepo: Turborepo + Bun. Editor is React + Konva; API is Nest.

## Where things live

| Concern | Path |
|--------|------|
| Public editor store API | `apps/editor/src/store/editorStore.ts` (thin compose) |
| Store slices | `apps/editor/src/store/slices/*` |
| Store helpers | `apps/editor/src/store/helpers.ts`, `types.ts` |
| Canvas shell | `apps/editor/src/components/canvas/CanvasStage.tsx` |
| Tool plugins | `apps/editor/src/components/canvas/tools/` — register in `index.ts` |
| Tool registry | `tools/registry.ts` + `useToolDispatch.ts` |
| Menus | `apps/editor/src/components/toolbar/menus/` |
| Tool options UI | `apps/editor/src/components/toolbar/options/` |
| Pixel algorithms | `libs/editor-core/src/` |
| Konva filters / listening | `libs/editor-konva/src/` |
| Shared types | `libs/shared/types/src/editor.types.ts` |
| AI HTTP client | `libs/editor-ai-client/` |
| API (stock, AI, projects) | `apps/api/src/` |

## Adding a canvas tool

1. Implement `ToolHandler` in `apps/editor/src/components/canvas/tools/myTool.ts(x)`.
2. `registerTool(handler)` from `tools/index.ts`.
3. Add `ToolType` in `libs/shared/types/src/editor.types.ts` if new.
4. Add ToolsPanel entry + OptionsBar options component.
5. Update `listeningPolicy` in editor-konva if cursor/listening differs.

## Adding store behavior

Put domain logic in the matching slice (`layersSlice`, `aiSlice`, …). Cross-slice calls use `get().otherAction()`. Do not grow `editorStore.ts` beyond composition.

## Algorithms

Prefer `libs/editor-core` for pure image ops. `apps/editor/src/utils/photo*` are deprecated re-exports of editor-core.

## Commands

```bash
bun run dev            # editor :4200 + api :3001
bun run build:editor
bun run test:core
bun run test:konva
bun run test:editor
```

## UI rules

Industrial darkroom theme (CSS vars in `apps/editor/src/styles.css`). No Inter/Roboto/Arial. Keep `useEditorStore` import path stable for UI.

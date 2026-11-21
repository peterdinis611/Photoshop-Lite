import { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HotkeysProvider } from '@tanstack/react-hotkeys';
import { PacerProvider } from '@tanstack/react-pacer';
import { KonvaStageProvider } from '@photoshop-lite/editor-konva';
import { useEditorStore } from '../store/editorStore';
import { TopNavBar } from '../components/toolbar/TopNavBar';
import { OptionsBar } from '../components/toolbar/OptionsBar';
import { ToolsPanel } from '../components/toolbar/ToolsPanel';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { CanvasDropZone } from '../components/canvas/CanvasDropZone';
import { RightSidebar } from '../components/panels/RightSidebar';
import { StatusBar } from '../components/toolbar/StatusBar';
import { FloatingAIStatusToast } from '../components/ui/FloatingAIStatusToast';
import { AppToaster } from '../components/ui/AppToaster';
import { useAutoStartOnboarding } from '../components/onboarding/useAutoStartOnboarding';
import { useEditorHotkeys } from '../hooks/useEditorHotkeys';
import { usePageMeta } from '../seo/usePageMeta';
import { SkipLink } from '../a11y/SkipLink';

const ExportModal = lazy(() =>
  import('../components/modals/ExportModal').then((m) => ({ default: m.ExportModal }))
);
const SettingsModal = lazy(() =>
  import('../components/modals/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const NewCanvasModal = lazy(() =>
  import('../components/modals/NewCanvasModal').then((m) => ({ default: m.NewCanvasModal }))
);
const ShortcutsModal = lazy(() =>
  import('../components/modals/ShortcutsModal').then((m) => ({ default: m.ShortcutsModal }))
);
const ImageSizeModal = lazy(() =>
  import('../components/modals/ImageSizeModal').then((m) => ({ default: m.ImageSizeModal }))
);
const StockPickerModal = lazy(() =>
  import('../components/modals/StockPickerModal').then((m) => ({ default: m.StockPickerModal }))
);
const ExifModal = lazy(() =>
  import('../components/modals/ExifModal').then((m) => ({ default: m.ExifModal }))
);
const IconifyModal = lazy(() =>
  import('../components/modals/IconifyModal').then((m) => ({ default: m.IconifyModal }))
);
const VersionHistoryModal = lazy(() =>
  import('../components/modals/VersionHistoryModal').then((m) => ({
    default: m.VersionHistoryModal,
  }))
);
const OnboardingTour = lazy(() =>
  import('../components/onboarding/OnboardingTour').then((m) => ({ default: m.OnboardingTour }))
);

function EditorWorkspace() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fitToScreen = useEditorStore((s) => s.fitToScreen);
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const activeTool = useEditorStore((s) => s.activeTool);
  const loadProjectFromCloud = useEditorStore((s) => s.loadProjectFromCloud);
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    const cloudId = new URLSearchParams(window.location.search).get('cloud');
    if (!cloudId) return;
    let cancelled = false;
    void loadProjectFromCloud(cloudId).finally(() => {
      if (cancelled) return;
      const next = new URLSearchParams(window.location.search);
      next.delete('cloud');
      setSearchParams(next, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [loadProjectFromCloud, setSearchParams]);

  usePageMeta({
    title: 'Editor — PhotoshopLite',
    description:
      'Open the PhotoshopLite darkroom: layers, retouch, AI cutout, and export in your browser.',
    robots: 'noindex, nofollow',
    canonicalPath: '/editor',
    ogTitle: 'PhotoshopLite Editor',
  });

  const handleFit = useCallback(() => {
    if (canvasContainerRef.current) {
      fitToScreen(
        canvasContainerRef.current.clientWidth,
        canvasContainerRef.current.clientHeight
      );
    }
  }, [fitToScreen]);

  useEditorHotkeys({ canvasContainerRef, onFitToScreen: handleFit });
  useAutoStartOnboarding();

  const selected = layers.find((l) => l.id === selectedLayerId);
  const canvasSummary = selected
    ? `Canvas. Selected layer: ${selected.name}, type ${selected.type}. Active tool: ${activeTool}. ${layers.length} layers total.`
    : layers.length === 0
      ? `Empty canvas. Active tool: ${activeTool}. Use Place or File menu to open an image. Layers panel lists document structure.`
      : `Canvas with ${layers.length} layers. No layer selected. Active tool: ${activeTool}.`;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
      <SkipLink href="#document-canvas">Skip to canvas</SkipLink>
      <SkipLink href="#editor-status">Skip to status</SkipLink>
      <h1 className="sr-only">PhotoshopLite editor</h1>

      <TopNavBar onFitToScreen={handleFit} />
      <OptionsBar />

      <div className="relative flex flex-1 overflow-hidden">
        <ToolsPanel />
        <main
          id="document-canvas"
          ref={canvasContainerRef}
          className="shell-canvas relative h-full flex-1 overflow-hidden"
          data-tour="tour-canvas"
          tabIndex={-1}
          aria-label={canvasSummary}
        >
          <p className="sr-only" id="canvas-instructions">
            Pixel canvas is visual. Use the Tools panel, Layers panel, and menus for keyboard
            editing. Status bar announces selection and tool hints.
          </p>
          <CanvasStage containerRef={canvasContainerRef} />
          <CanvasDropZone onImagesAdded={handleFit} />
        </main>
        <RightSidebar />
      </div>

      <StatusBar />

      <Suspense fallback={null}>
        <ExportModal />
        <SettingsModal />
        <NewCanvasModal />
        <ImageSizeModal />
        <StockPickerModal />
        <ExifModal />
        <IconifyModal />
        <VersionHistoryModal />
        <ShortcutsModal />
        <OnboardingTour />
      </Suspense>
      <FloatingAIStatusToast />
      <AppToaster />
    </div>
  );
}

/** Full editor route — Konva / hotkeys / pacer stay off the landing bundle. */
export default function EditorShell() {
  return (
    <KonvaStageProvider>
      <PacerProvider
        defaultOptions={{
          debouncer: { wait: 200 },
          throttler: { wait: 16, leading: true, trailing: true },
          asyncThrottler: { wait: 50, leading: true, trailing: true },
        }}
      >
        <HotkeysProvider
          defaultOptions={{
            hotkey: {
              preventDefault: true,
              stopPropagation: true,
              conflictBehavior: 'allow',
            },
          }}
        >
          <EditorWorkspace />
        </HotkeysProvider>
      </PacerProvider>
    </KonvaStageProvider>
  );
}

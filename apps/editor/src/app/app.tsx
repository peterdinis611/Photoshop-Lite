import { useCallback, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { HotkeysProvider } from '@tanstack/react-hotkeys';
import { PacerProvider } from '@tanstack/react-pacer';
import { useEditorStore } from '../store/editorStore';
import { TopNavBar } from '../components/toolbar/TopNavBar';
import { OptionsBar } from '../components/toolbar/OptionsBar';
import { ToolsPanel } from '../components/toolbar/ToolsPanel';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { CanvasDropZone } from '../components/canvas/CanvasDropZone';
import { RightSidebar } from '../components/panels/RightSidebar';
import { ExportModal } from '../components/modals/ExportModal';
import { SettingsModal } from '../components/modals/SettingsModal';
import { NewCanvasModal } from '../components/modals/NewCanvasModal';
import { ShortcutsModal } from '../components/modals/ShortcutsModal';
import { ImageSizeModal } from '../components/modals/ImageSizeModal';
import { StockPickerModal } from '../components/modals/StockPickerModal';
import { ExifModal } from '../components/modals/ExifModal';
import { IconifyModal } from '../components/modals/IconifyModal';
import { OnboardingTour } from '../components/onboarding/OnboardingTour';
import { useAutoStartOnboarding } from '../components/onboarding/useAutoStartOnboarding';
import { FloatingAIStatusToast } from '../components/ui/FloatingAIStatusToast';
import { StatusBar } from '../components/toolbar/StatusBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { KonvaStageProvider } from '@photoshop-lite/editor-konva';
import { useEditorHotkeys } from '../hooks/useEditorHotkeys';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LandingPage } from '../pages/LandingPage';
import { usePageMeta } from '../seo/usePageMeta';
import { SkipLink } from '../a11y/SkipLink';

function EditorShell() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fitToScreen = useEditorStore((s) => s.fitToScreen);
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const activeTool = useEditorStore((s) => s.activeTool);

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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
      <SkipLink href="#document-canvas">Skip to canvas</SkipLink>
      <SkipLink href="#editor-status">Skip to status</SkipLink>
      <h1 className="sr-only">PhotoshopLite editor</h1>

      <TopNavBar onFitToScreen={handleFit} />
      <OptionsBar />

      <div className="flex-1 flex overflow-hidden relative">
        <ToolsPanel />
        <main
          id="document-canvas"
          ref={canvasContainerRef}
          className="shell-canvas flex-1 relative overflow-hidden h-full"
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

      <ExportModal />
      <SettingsModal />
      <NewCanvasModal />
      <ImageSizeModal />
      <StockPickerModal />
      <ExifModal />
      <IconifyModal />
      <ShortcutsModal />
      <OnboardingTour />
      <FloatingAIStatusToast />
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
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
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/editor" element={<EditorShell />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </HotkeysProvider>
        </PacerProvider>
      </KonvaStageProvider>
    </ErrorBoundary>
  );
}

export default App;

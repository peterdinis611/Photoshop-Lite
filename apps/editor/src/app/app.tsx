import React, { useCallback, useRef } from 'react';
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
import {
  OnboardingTour,
  useAutoStartOnboarding,
} from '../components/onboarding/OnboardingTour';
import { FloatingAIStatusToast } from '../components/ui/FloatingAIStatusToast';
import { useEditorHotkeys } from '../hooks/useEditorHotkeys';

function EditorShell() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fitToScreen = useEditorStore((s) => s.fitToScreen);

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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
      <TopNavBar onFitToScreen={handleFit} />
      <OptionsBar />

      <div className="flex-1 flex overflow-hidden relative">
        <ToolsPanel />
        <main
          ref={canvasContainerRef}
          className="shell-canvas flex-1 relative overflow-hidden h-full"
        >
          <CanvasStage containerRef={canvasContainerRef} />
          <CanvasDropZone onImagesAdded={handleFit} />
        </main>
        <RightSidebar />
      </div>

      <ExportModal />
      <SettingsModal />
      <NewCanvasModal />
      <ShortcutsModal />
      <OnboardingTour />
      <FloatingAIStatusToast />
    </div>
  );
}

export function App() {
  return (
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
        <EditorShell />
      </HotkeysProvider>
    </PacerProvider>
  );
}

export default App;

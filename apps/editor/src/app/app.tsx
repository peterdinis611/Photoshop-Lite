import React, { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { TopNavBar } from '../components/toolbar/TopNavBar';
import { OptionsBar } from '../components/toolbar/OptionsBar';
import { ToolsPanel } from '../components/toolbar/ToolsPanel';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { RightSidebar } from '../components/panels/RightSidebar';
import { ExportModal } from '../components/modals/ExportModal';
import { SettingsModal } from '../components/modals/SettingsModal';
import { NewCanvasModal } from '../components/modals/NewCanvasModal';
import { FloatingAIStatusToast } from '../components/ui/FloatingAIStatusToast';
import { SAMPLE_IMAGES } from '../assets/sampleImages';
import { clearImageSelection } from '../utils/maskHelpers';

export function App() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const {
    layers,
    selectedLayerId,
    addImageLayer,
    fitToScreen,
    undo,
    redo,
    duplicateLayer,
    removeLayer,
    setActiveTool,
    setZoom,
    saveProject,
    setMarqueeSelection,
    updateLayer,
    commitHistory,
  } = useEditorStore();

  // Load default demo image on first mount if canvas is empty
  useEffect(() => {
    if (layers.length === 0) {
      const portraitSample = SAMPLE_IMAGES[0];
      addImageLayer(portraitSample.dataUrl, portraitSample.name, portraitSample.width, portraitSample.height);

      // Fit to container on initial load
      setTimeout(() => {
        if (canvasContainerRef.current) {
          fitToScreen(
            canvasContainerRef.current.clientWidth,
            canvasContainerRef.current.clientHeight
          );
        }
      }, 150);
    }
  }, [layers.length, addImageLayer, fitToScreen]);

  // Global Keyboard Shortcuts (Photoshop style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Save project: Cmd+S
      if (cmdKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveProject();
        return;
      }

      // Fit to screen: Cmd+0
      if (cmdKey && e.key === '0') {
        e.preventDefault();
        if (canvasContainerRef.current) {
          fitToScreen(
            canvasContainerRef.current.clientWidth,
            canvasContainerRef.current.clientHeight
          );
        }
        return;
      }

      // Actual size: Cmd+1
      if (cmdKey && e.key === '1') {
        e.preventDefault();
        setZoom(1);
        return;
      }

      // Undo / Redo
      if (cmdKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (cmdKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Duplicate layer: Cmd+D or Ctrl+D
      if (cmdKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedLayerId) {
          duplicateLayer(selectedLayerId);
        }
        return;
      }

      // Delete: marquee clears pixels, else delete layer
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const sel = useEditorStore.getState().marqueeSelection;
        const layer = useEditorStore.getState().layers.find((l) => l.id === selectedLayerId);
        if (sel && layer?.type === 'image') {
          commitHistory('Clear Selection');
          clearImageSelection({
            src: layer.src,
            layerX: layer.x,
            layerY: layer.y,
            layerWidth: layer.width,
            layerHeight: layer.height,
            selection: sel,
          }).then((newSrc) => {
            updateLayer(layer.id, { src: newSrc });
            setMarqueeSelection(null);
          });
          return;
        }
        if (selectedLayerId) {
          removeLayer(selectedLayerId);
        }
        return;
      }

      // Escape clears marquee
      if (e.key === 'Escape') {
        setMarqueeSelection(null);
        return;
      }

      // Tool shortcuts (without Cmd/Ctrl)
      if (!cmdKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            setActiveTool('select');
            break;
          case 'm':
            setActiveTool('marquee');
            break;
          case 'l':
            setActiveTool('lasso');
            break;
          case 'w':
            setActiveTool('wand');
            break;
          case 'c':
            setActiveTool('crop');
            break;
          case 'b':
            setActiveTool('brush');
            break;
          case 'e':
            setActiveTool('eraser');
            break;
          case 'r':
            setActiveTool('refineBrush');
            break;
          case 't':
            setActiveTool('text');
            break;
          case 'u':
            setActiveTool('shape');
            break;
          case 's':
            setActiveTool('clone');
            break;
          case 'i':
            setActiveTool('eyedropper');
            break;
          case 'j':
            setActiveTool('spotHealing');
            break;
          case 'h':
            setActiveTool('hand');
            break;
          case 'z':
            setActiveTool('zoom');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo,
    redo,
    duplicateLayer,
    removeLayer,
    selectedLayerId,
    setActiveTool,
    saveProject,
    fitToScreen,
    setZoom,
    updateLayer,
    commitHistory,
    setMarqueeSelection,
  ]);

  const handleFit = () => {
    if (canvasContainerRef.current) {
      fitToScreen(
        canvasContainerRef.current.clientWidth,
        canvasContainerRef.current.clientHeight
      );
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* Top Menu Bar */}
      <TopNavBar onFitToScreen={handleFit} />

      {/* Contextual Options Bar */}
      <OptionsBar />

      {/* Main Workspace: Left Tools + Center Canvas + Right Panels */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Toolbar */}
        <ToolsPanel />

        {/* Center Canvas Area */}
        <main ref={canvasContainerRef} className="flex-1 relative overflow-hidden h-full">
          <CanvasStage containerRef={canvasContainerRef} />
        </main>

        {/* Right Sidebar: Layers, Adjustments, AI Suite, Styles, History */}
        <RightSidebar />
      </div>

      {/* Modals */}
      <ExportModal />
      <SettingsModal />
      <NewCanvasModal />

      {/* Floating AI Notification Toast */}
      <FloatingAIStatusToast />
    </div>
  );
}

export default App;

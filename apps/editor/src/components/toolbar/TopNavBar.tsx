import React, { useEffect, useRef, useState } from 'react';
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Sparkles,
  Scissors,
  Image as ImageIcon,
  FolderOpen,
  Settings,
  FilePlus,
  Copy,
  Trash2,
  FlipHorizontal,
  FlipVertical,
  EyeOff,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Maximize,
  Contrast,
  Aperture,
  Square,
  Save,
  ChevronDown,
  SunMedium,
  Eraser,
  Cloud,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { SAMPLE_IMAGES } from '../../assets/sampleImages';
import { PROJECT_FILE_EXTENSION, readProjectFile } from '../../utils/projectFile';
import type { ReviveMode } from '../../utils/photoRevive';
import type { CleanupMode } from '../../utils/photoCleanup';
import type { ProjectSummaryDto } from '@photoshop-lite/shared-types';

interface TopNavBarProps {
  onFitToScreen: () => void;
}

type MenuId =
  | 'file'
  | 'edit'
  | 'image'
  | 'layer'
  | 'select'
  | 'filter'
  | 'view'
  | 'revive'
  | 'cleanup'
  | null;

const MenuBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: boolean;
}> = ({ active, onClick, children, accent }) => (
  <button
    onClick={onClick}
    className={`px-2.5 py-1 rounded-[var(--radius-sm)] text-[12px] font-medium transition-colors cursor-pointer ${
      active
        ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
        : accent
          ? 'text-[var(--accent-hot)] hover:bg-[var(--accent-dim)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
    }`}
  >
    {children}
  </button>
);

const MenuPanel: React.FC<{
  width?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ width = 'w-56', onClose, children }) => (
  <div
    className={`absolute top-full left-0 mt-1 ${width} bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] shadow-2xl py-1.5 z-50 text-[12px]`}
    onMouseLeave={onClose}
  >
    {children}
  </div>
);

const Item: React.FC<{
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ onClick, disabled, danger, hint, children }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-3 disabled:opacity-35 cursor-pointer transition-colors ${
      danger
        ? 'text-[var(--danger)] hover:bg-[var(--danger)]/15'
        : 'text-[var(--text-muted)] hover:bg-[var(--accent)] hover:text-[#1a1208]'
    }`}
  >
    <span className="flex items-center gap-2 min-w-0">{children}</span>
    {hint && <span className="text-[10px] font-mono-ui text-[var(--text-faint)] shrink-0">{hint}</span>}
  </button>
);

const Sep = () => <div className="my-1.5 border-t border-[var(--border-subtle)]" />;

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="px-3 py-1 text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em] font-semibold font-mono-ui">
    {children}
  </div>
);

export const TopNavBar: React.FC<TopNavBarProps> = ({ onFitToScreen }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const [activeMenu, setActiveMenu] = useState<MenuId>(null);
  const [cloudProjects, setCloudProjects] = useState<ProjectSummaryDto[]>([]);

  const {
    zoom,
    setZoom,
    undo,
    redo,
    past,
    future,
    layers,
    selectedLayerId,
    setExportModalOpen,
    setSettingsModalOpen,
    setNewCanvasModalOpen,
    showGrid,
    showRulers,
    toggleGrid,
    toggleRulers,
    addImageLayer,
    removeBackground,
    revivePhotoLayer,
    cleanPhotoLayer,
    upscaleLayer,
    aiStatus,
    duplicateLayer,
    removeLayer,
    selectLayer,
    saveProject,
    loadProject,
    saveProjectToCloud,
    listCloudProjects,
    loadProjectFromCloud,
    projectTitle,
    updateLayer,
    updateAdjustments,
    reorderLayers,
    toggleLayerVisibility,
    toggleLayerLock,
    setActiveTool,
    canvasWidth,
    canvasHeight,
  } = useEditorStore();

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const isImageSelected = selectedLayer?.type === 'image';
  const selectedIndex = layers.findIndex((l) => l.id === selectedLayerId);

  const resolveImageId = () =>
    isImageSelected
      ? selectedLayerId
      : layers.slice().reverse().find((l) => l.type === 'image')?.id ?? null;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const close = () => setActiveMenu(null);
  const toggle = (id: MenuId) => {
    setActiveMenu((m) => {
      const next = m === id ? null : id;
      if (next === 'file') {
        listCloudProjects()
          .then(setCloudProjects)
          .catch(() => setCloudProjects([]));
      }
      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        addImageLayer(src, file.name.replace(/\.[^/.]+$/, ''), img.naturalWidth, img.naturalHeight);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    close();
  };

  const handleProjectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      loadProject(await readProjectFile(file));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open project');
    }
    e.target.value = '';
    close();
  };

  const handleLoadSample = (sampleId: string) => {
    const sample = SAMPLE_IMAGES.find((s) => s.id === sampleId);
    if (!sample) return;
    addImageLayer(sample.dataUrl, sample.name, sample.width, sample.height);
    close();
  };

  const runRevive = (mode: ReviveMode, bake = false) => {
    const id = resolveImageId();
    if (!id) return;
    selectLayer(id);
    revivePhotoLayer(id, mode, 0.8, bake);
    close();
  };

  const runCleanup = (mode: CleanupMode = 'standard', bake = true) => {
    const id = resolveImageId();
    if (!id) return;
    selectLayer(id);
    cleanPhotoLayer(id, mode, 0.7, bake);
    close();
  };

  const flip = (axis: 'h' | 'v') => {
    if (!selectedLayer) return;
    if (axis === 'h') updateLayer(selectedLayer.id, { scaleX: -selectedLayer.scaleX });
    else updateLayer(selectedLayer.id, { scaleY: -selectedLayer.scaleY });
    close();
  };

  const centerLayer = () => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, {
      x: Math.round((canvasWidth - selectedLayer.width * Math.abs(selectedLayer.scaleX)) / 2),
      y: Math.round((canvasHeight - selectedLayer.height * Math.abs(selectedLayer.scaleY)) / 2),
    });
    close();
  };

  const moveLayer = (dir: 'up' | 'down') => {
    if (selectedIndex < 0) return;
    const to = dir === 'up' ? selectedIndex + 1 : selectedIndex - 1;
    if (to < 0 || to >= layers.length) return;
    reorderLayers(selectedIndex, to);
    close();
  };

  return (
    <header
      ref={barRef}
      className="h-12 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] px-2.5 flex items-center gap-2 z-50 select-none"
    >
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input
        ref={projectInputRef}
        type="file"
        accept={`.json,${PROJECT_FILE_EXTENSION},application/json`}
        className="hidden"
        onChange={handleProjectFileChange}
      />

      {/* Brand */}
      <div className="flex items-center gap-2 pr-2.5 border-r border-[var(--border-subtle)] shrink-0">
        <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--accent)] flex items-center justify-center font-display font-extrabold text-[#1a1208] text-[11px]">
          Ps
        </div>
        <div className="hidden md:flex flex-col leading-none">
          <span className="font-display font-bold text-[13px] text-[var(--text-primary)] tracking-tight">
            Photoshop<span className="text-[var(--accent-hot)]">Lite</span>
          </span>
          <span className="text-[9px] font-mono-ui text-[var(--text-faint)] truncate max-w-[110px]">
            {projectTitle || 'Untitled'}
          </span>
        </div>
      </div>

      {/* Photoshop-style menus */}
      <nav className="flex items-center gap-0.5 shrink-0">
        <div className="relative">
          <MenuBtn active={activeMenu === 'file'} onClick={() => toggle('file')}>
            File
          </MenuBtn>
          {activeMenu === 'file' && (
            <MenuPanel onClose={close}>
              <Item onClick={() => { setNewCanvasModalOpen(true); close(); }} hint="⌘N">
                <FilePlus size={13} /> New…
              </Item>
              <Item onClick={() => fileInputRef.current?.click()} hint="⌘O">
                <FolderOpen size={13} /> Place Image…
              </Item>
              <Item onClick={() => projectInputRef.current?.click()}>
                <FolderOpen size={13} /> Open Project…
              </Item>
              <Item onClick={() => { saveProject(); close(); }} hint="⌘S">
                <Save size={13} /> Save Project
              </Item>
              <Item
                onClick={async () => {
                  try {
                    await saveProjectToCloud();
                  } catch {
                    /* toast via aiStatus */
                  }
                  close();
                }}
              >
                <Cloud size={13} /> Save to Cloud
              </Item>
              <Sep />
              <Label>Cloud projects</Label>
              {cloudProjects.length === 0 ? (
                <div className="px-3 py-1.5 text-[11px] text-[var(--text-faint)]">
                  No cloud projects (start API)
                </div>
              ) : (
                cloudProjects.slice(0, 8).map((p) => (
                  <Item
                    key={p.id}
                    onClick={async () => {
                      try {
                        await loadProjectFromCloud(p.id);
                      } catch {
                        /* toast */
                      }
                      close();
                    }}
                  >
                    <Cloud size={13} /> {p.title}
                  </Item>
                ))
              )}
              <Sep />
              <Label>Samples</Label>
              {SAMPLE_IMAGES.map((s) => (
                <Item key={s.id} onClick={() => handleLoadSample(s.id)}>
                  <ImageIcon size={13} /> {s.name}
                </Item>
              ))}
              <Sep />
              <Item onClick={() => { setExportModalOpen(true); close(); }} hint="⌘E">
                <Download size={13} /> Export As…
              </Item>
            </MenuPanel>
          )}
        </div>

        <div className="relative">
          <MenuBtn active={activeMenu === 'edit'} onClick={() => toggle('edit')}>
            Edit
          </MenuBtn>
          {activeMenu === 'edit' && (
            <MenuPanel onClose={close} width="w-52">
              <Item disabled={past.length === 0} onClick={() => { undo(); close(); }} hint="⌘Z">
                <Undo2 size={13} /> Undo
              </Item>
              <Item disabled={future.length === 0} onClick={() => { redo(); close(); }} hint="⌘Y">
                <Redo2 size={13} /> Redo
              </Item>
              <Sep />
              <Item disabled={!selectedLayerId} onClick={() => { if (selectedLayerId) duplicateLayer(selectedLayerId); close(); }} hint="⌘D">
                <Copy size={13} /> Duplicate
              </Item>
              <Item disabled={!selectedLayerId} danger onClick={() => { if (selectedLayerId) removeLayer(selectedLayerId); close(); }} hint="Del">
                <Trash2 size={13} /> Delete
              </Item>
              <Sep />
              <Item disabled={!selectedLayer} onClick={() => flip('h')}>
                <FlipHorizontal size={13} /> Flip Horizontal
              </Item>
              <Item disabled={!selectedLayer} onClick={() => flip('v')}>
                <FlipVertical size={13} /> Flip Vertical
              </Item>
              <Item disabled={!selectedLayer} onClick={centerLayer}>
                <Maximize2 size={13} /> Center on Canvas
              </Item>
              <Item onClick={() => { setSettingsModalOpen(true); close(); }}>
                <Settings size={13} /> Preferences…
              </Item>
            </MenuPanel>
          )}
        </div>

        <div className="relative">
          <MenuBtn active={activeMenu === 'image'} onClick={() => toggle('image')}>
            Image
          </MenuBtn>
          {activeMenu === 'image' && (
            <MenuPanel onClose={close} width="w-60">
              <Label>Adjustments</Label>
              <Item disabled={!resolveImageId()} onClick={() => runRevive('natural')}>
                <SunMedium size={13} /> Auto Tone (Revive)
              </Item>
              <Item disabled={!resolveImageId()} onClick={() => runRevive('vivid')}>
                <Sparkles size={13} /> Auto Contrast (Vivid)
              </Item>
              <Item disabled={!resolveImageId()} onClick={() => runRevive('shadows')}>
                <Aperture size={13} /> Shadow Lift
              </Item>
              <Item disabled={!resolveImageId()} onClick={() => runCleanup('standard')}>
                <Eraser size={13} /> Photo Cleanup
              </Item>
              <Item
                disabled={!isImageSelected}
                onClick={() => {
                  if (selectedLayerId && isImageSelected) {
                    updateAdjustments(selectedLayerId, { saturation: -100, grayscale: true });
                  }
                  close();
                }}
              >
                <Contrast size={13} /> Desaturate
              </Item>
              <Item
                disabled={!isImageSelected}
                onClick={() => {
                  if (selectedLayerId && isImageSelected) {
                    updateAdjustments(selectedLayerId, { invert: true });
                  }
                  close();
                }}
              >
                Invert
              </Item>
              <Sep />
              <Label>Size</Label>
              <Item
                disabled={!isImageSelected || aiStatus.isProcessing}
                onClick={() => {
                  if (selectedLayerId) upscaleLayer(selectedLayerId, 2);
                  close();
                }}
              >
                <Maximize size={13} /> Image Size · Upscale 2×
              </Item>
              <Item
                disabled={!isImageSelected || aiStatus.isProcessing}
                onClick={() => {
                  if (selectedLayerId) upscaleLayer(selectedLayerId, 4);
                  close();
                }}
              >
                <Maximize size={13} /> Image Size · Upscale 4×
              </Item>
              <Item onClick={() => { setNewCanvasModalOpen(true); close(); }}>
                Canvas Size…
              </Item>
            </MenuPanel>
          )}
        </div>

        <div className="relative">
          <MenuBtn active={activeMenu === 'layer'} onClick={() => toggle('layer')}>
            Layer
          </MenuBtn>
          {activeMenu === 'layer' && (
            <MenuPanel onClose={close} width="w-52">
              <Item disabled={!selectedLayerId} onClick={() => { if (selectedLayerId) duplicateLayer(selectedLayerId); close(); }}>
                <Copy size={13} /> Duplicate Layer
              </Item>
              <Item disabled={!selectedLayerId} danger onClick={() => { if (selectedLayerId) removeLayer(selectedLayerId); close(); }}>
                <Trash2 size={13} /> Delete Layer
              </Item>
              <Sep />
              <Item disabled={selectedIndex < 0 || selectedIndex >= layers.length - 1} onClick={() => moveLayer('up')}>
                <ArrowUp size={13} /> Bring Forward
              </Item>
              <Item disabled={selectedIndex <= 0} onClick={() => moveLayer('down')}>
                <ArrowDown size={13} /> Send Backward
              </Item>
              <Sep />
              <Item disabled={!selectedLayerId} onClick={() => { if (selectedLayerId) toggleLayerVisibility(selectedLayerId); close(); }}>
                <EyeOff size={13} /> Toggle Visibility
              </Item>
              <Item disabled={!selectedLayerId} onClick={() => { if (selectedLayerId) toggleLayerLock(selectedLayerId); close(); }}>
                {selectedLayer?.locked ? <Unlock size={13} /> : <Lock size={13} />}{' '}
                {selectedLayer?.locked ? 'Unlock' : 'Lock'} Layer
              </Item>
            </MenuPanel>
          )}
        </div>

        <div className="relative">
          <MenuBtn active={activeMenu === 'select'} onClick={() => toggle('select')}>
            Select
          </MenuBtn>
          {activeMenu === 'select' && (
            <MenuPanel onClose={close} width="w-48">
              <Item onClick={() => { setActiveTool('marquee'); close(); }} hint="M">
                <Square size={13} /> Rectangular Marquee
              </Item>
              <Item onClick={() => { setActiveTool('select'); close(); }} hint="V">
                Move Tool
              </Item>
              <Sep />
              <Item onClick={() => { selectLayer(null); close(); }} hint="Esc">
                Deselect
              </Item>
              <Item
                disabled={layers.length === 0}
                onClick={() => {
                  const top = layers[layers.length - 1];
                  if (top) selectLayer(top.id);
                  close();
                }}
              >
                Select Top Layer
              </Item>
            </MenuPanel>
          )}
        </div>

        <div className="relative">
          <MenuBtn active={activeMenu === 'filter'} onClick={() => toggle('filter')} accent>
            Filter
          </MenuBtn>
          {activeMenu === 'filter' && (
            <MenuPanel onClose={close} width="w-56">
              <Label>Neural</Label>
              <Item disabled={!resolveImageId() || aiStatus.isProcessing} onClick={() => runRevive('natural')}>
                <SunMedium size={13} /> Photo Revive…
              </Item>
              <Item disabled={!resolveImageId() || aiStatus.isProcessing} onClick={() => runRevive('clarity')}>
                Sharpen · Clarity
              </Item>
              <Item disabled={!resolveImageId() || aiStatus.isProcessing} onClick={() => runRevive('film')}>
                Film Glow
              </Item>
              <Sep />
              <Label>Cleanup</Label>
              <Item disabled={!resolveImageId() || aiStatus.isProcessing} onClick={() => runCleanup('standard')}>
                <Eraser size={13} /> Photo Cleanup…
              </Item>
              <Item disabled={!resolveImageId() || aiStatus.isProcessing} onClick={() => runCleanup('gentle')}>
                Gentle Denoise
              </Item>
              <Item disabled={!resolveImageId() || aiStatus.isProcessing} onClick={() => runCleanup('dust')}>
                Dust & Spots
              </Item>
              <Item disabled={!resolveImageId() || aiStatus.isProcessing} onClick={() => runCleanup('strong')}>
                Strong Denoise
              </Item>
              <Sep />
              <Item
                disabled={!resolveImageId() || aiStatus.isProcessing}
                onClick={() => {
                  const id = resolveImageId();
                  if (id) {
                    selectLayer(id);
                    removeBackground(id);
                  }
                  close();
                }}
              >
                <Scissors size={13} /> Remove Background
              </Item>
              <Item
                disabled={!isImageSelected || aiStatus.isProcessing}
                onClick={() => {
                  if (selectedLayerId) upscaleLayer(selectedLayerId, 2);
                  close();
                }}
              >
                <Maximize size={13} /> Super Resolution…
              </Item>
            </MenuPanel>
          )}
        </div>

        <div className="relative">
          <MenuBtn active={activeMenu === 'view'} onClick={() => toggle('view')}>
            View
          </MenuBtn>
          {activeMenu === 'view' && (
            <MenuPanel onClose={close} width="w-48">
              <Item onClick={() => { onFitToScreen(); close(); }} hint="⌘0">
                Fit on Screen
              </Item>
              <Item onClick={() => { setZoom(1); close(); }} hint="⌘1">
                100%
              </Item>
              <Sep />
              <Item onClick={() => { toggleRulers(); close(); }}>
                Rulers {showRulers ? '✓' : ''}
              </Item>
              <Item onClick={() => { toggleGrid(); close(); }}>
                Pixel Grid {showGrid ? '✓' : ''}
              </Item>
            </MenuPanel>
          )}
        </div>
      </nav>

      <div className="flex-1" />

      {/* History + Zoom cluster */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        <div className="flex items-center bg-[var(--bg-elevated)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] p-0.5">
          <button
            disabled={past.length === 0}
            onClick={undo}
            title="Undo"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 rounded-[4px] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <Undo2 size={14} />
          </button>
          <button
            disabled={future.length === 0}
            onClick={redo}
            title="Redo"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 rounded-[4px] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <Redo2 size={14} />
          </button>
        </div>

        <div className="flex items-center bg-[var(--bg-elevated)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-1 py-0.5 text-[var(--text-muted)]">
          <button
            onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))}
            className="p-1 hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <ZoomOut size={13} />
          </button>
          <span className="w-11 text-center font-mono-ui text-[11px] text-[var(--text-primary)]">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(8, z * 1.2))}
            className="p-1 hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <ZoomIn size={13} />
          </button>
          <div className="h-3 w-px bg-[var(--border-subtle)] mx-0.5" />
          <button
            onClick={onFitToScreen}
            title="Fit"
            className="p-1 hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Action dock — Photoshop-like grouped tools */}
      <div className="flex items-center gap-1.5 shrink-0 pl-1.5 border-l border-[var(--border-subtle)]">
        {/* Place / Demo segmented */}
        <div className="hidden lg:flex items-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] overflow-hidden">
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Place image"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer border-r border-[var(--border-subtle)]"
          >
            <FolderOpen size={12} />
            Place
          </button>
          <button
            onClick={() => handleLoadSample('sample-portrait')}
            title="Load demo photo"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <ImageIcon size={12} />
            Demo
          </button>
        </div>

        {/* Enhance group with Revive dropdown */}
        <div className="relative flex items-center bg-[var(--bg-elevated)] border border-[var(--accent)]/40 rounded-[var(--radius-sm)] overflow-hidden">
          <button
            disabled={aiStatus.isProcessing || !layers.some((l) => l.type === 'image')}
            onClick={() => runRevive('natural')}
            title="Photo Revive"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-display font-bold text-[var(--accent-hot)] hover:bg-[var(--accent-dim)] disabled:opacity-40 cursor-pointer"
          >
            <SunMedium size={13} />
            Revive
          </button>
          <button
            onClick={() => toggle('revive')}
            className="px-1.5 py-1.5 border-l border-[var(--accent)]/30 text-[var(--accent-hot)] hover:bg-[var(--accent-dim)] cursor-pointer"
            title="Revive modes"
          >
            <ChevronDown size={12} />
          </button>
          {activeMenu === 'revive' && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] shadow-2xl py-1.5 z-50 text-[12px]">
              <Label>Revive mode</Label>
              {(
                [
                  ['natural', 'Natural'],
                  ['vivid', 'Vivid'],
                  ['shadows', 'Shadow Lift'],
                  ['clarity', 'Clarity'],
                  ['film', 'Film Glow'],
                ] as const
              ).map(([mode, label]) => (
                <Item key={mode} onClick={() => runRevive(mode)}>
                  <Sparkles size={12} /> {label}
                </Item>
              ))}
              <Sep />
              <Item onClick={() => runRevive('vivid', true)}>
                <Copy size={12} /> Bake as New Layer
              </Item>
            </div>
          )}
        </div>

        <div className="relative flex items-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] overflow-hidden">
          <button
            disabled={aiStatus.isProcessing || !layers.some((l) => l.type === 'image')}
            onClick={() => runCleanup('standard')}
            title="Photo Cleanup"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-display font-bold text-[var(--ink-blue)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 cursor-pointer"
          >
            <Eraser size={13} />
            Clean
          </button>
          <button
            onClick={() => toggle('cleanup')}
            className="px-1.5 py-1.5 border-l border-[var(--border-subtle)] text-[var(--ink-blue)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            title="Cleanup modes"
          >
            <ChevronDown size={12} />
          </button>
          {activeMenu === 'cleanup' && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] shadow-2xl py-1.5 z-50 text-[12px]">
              <Label>Cleanup mode</Label>
              {(
                [
                  ['gentle', 'Gentle'],
                  ['standard', 'Standard'],
                  ['strong', 'Strong'],
                  ['dust', 'Dust & Spots'],
                ] as const
              ).map(([mode, label]) => (
                <Item key={mode} onClick={() => runCleanup(mode)}>
                  <Eraser size={12} /> {label}
                </Item>
              ))}
              <Sep />
              <Item onClick={() => runCleanup('standard', false)}>
                Replace current layer
              </Item>
            </div>
          )}
        </div>

        <button
          disabled={aiStatus.isProcessing || !layers.some((l) => l.type === 'image')}
          onClick={() => {
            const id = resolveImageId();
            if (id) {
              selectLayer(id);
              removeBackground(id);
            }
          }}
          title="Remove background"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--ink-blue)] hover:border-[var(--ink-blue)]/50 rounded-[var(--radius-sm)] disabled:opacity-40 cursor-pointer"
        >
          <Scissors size={12} />
          <span className="hidden md:inline">Cutout</span>
        </button>

        <button
          disabled={!selectedLayerId}
          onClick={() => selectedLayerId && duplicateLayer(selectedLayerId)}
          title="Duplicate layer (⌘D)"
          className="hidden xl:flex p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] disabled:opacity-40 cursor-pointer"
        >
          <Copy size={13} />
        </button>

        <button
          disabled={!selectedLayer}
          onClick={() => flip('h')}
          title="Flip horizontal"
          className="hidden xl:flex p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] disabled:opacity-40 cursor-pointer"
        >
          <FlipHorizontal size={13} />
        </button>

        <button
          onClick={() => setExportModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-display font-bold text-[#1a1208] bg-[var(--accent)] hover:bg-[var(--accent-hot)] rounded-[var(--radius-sm)] cursor-pointer active:scale-[0.98]"
        >
          <Download size={13} />
          Export
        </button>
      </div>
    </header>
  );
};

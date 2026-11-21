import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDebouncedCallback } from '@tanstack/react-pacer';
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
  Copy,
  FlipHorizontal,
  ChevronDown,
  SunMedium,
  Eraser,
  Pencil,
} from 'pulsoicon-react';
import type { ProjectSummaryDto } from '@photoshop-lite/shared-types';
import { useEditorStore } from '../../store/editorStore';
import { findSampleImage } from '../../assets/loadSampleImages';
import { PROJECT_FILE_EXTENSION, readProjectFile } from '../../utils/projectFile';
import { IMAGE_ACCEPT, loadImageFiles } from '../../utils/loadImageFiles';
import { importPsdFile } from '../../utils/psdImport';
import { notify } from '../../utils/notify';
import {
  commitPlateTitle,
  isUnnamedPlate,
  plateRenameDraft,
  resolvePlateTitle,
} from '../../utils/plateTitle';
import {
  AnimatedMenu,
  MenuItem as Item,
  MenuLabel as Label,
  MenuSep as Sep,
} from '../ui/AnimatedMenu';
import {
  FileMenu,
  EditMenu,
  ImageMenu,
  LayerMenu,
  SelectMenu,
  FilterMenu,
  ViewMenu,
  useMenuActions,
} from './menus';

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
  label: string;
}> = ({ active, onClick, children, accent, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-expanded={active}
    aria-haspopup="menu"
    aria-label={`${label} menu`}
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

/** Menu bar entries, in display order. */
const MENU_BUTTONS: { id: Exclude<MenuId, 'revive' | 'cleanup' | null>; label: string; accent?: boolean }[] = [
  { id: 'file', label: 'File' },
  { id: 'edit', label: 'Edit' },
  { id: 'image', label: 'Image' },
  { id: 'layer', label: 'Layer' },
  { id: 'select', label: 'Select' },
  { id: 'filter', label: 'Filter', accent: true },
  { id: 'view', label: 'View' },
];

export const TopNavBar: React.FC<TopNavBarProps> = ({ onFitToScreen }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const psdInputRef = useRef<HTMLInputElement>(null);
  const smartObjectInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const [activeMenu, setActiveMenu] = useState<MenuId>(null);
  const [cloudProjects, setCloudProjects] = useState<ProjectSummaryDto[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const {
    zoom,
    setZoom,
    undo,
    redo,
    past,
    future,
    setExportModalOpen,
    addImageLayer,
    removeBackground,
    selectLayer,
    aiStatus,
    duplicateLayer,
    listCloudProjects,
    loadProject,
    projectTitle,
    setProjectTitle,
    updateLayer,
    createBlankDocument,
    replaceSmartObjectSource,
  } = useEditorStore();

  const close = () => setActiveMenu(null);

  const { layers, selectedLayerId, selectedLayer, resolveImageId, runRevive, runCleanup, flip } =
    useMenuActions(close);

  const resolvedTitle = resolvePlateTitle(projectTitle);
  const isUnnamed = isUnnamedPlate(projectTitle);

  const beginRename = () => {
    setTitleDraft(plateRenameDraft(projectTitle));
    setEditingTitle(true);
    window.setTimeout(() => titleInputRef.current?.select(), 0);
  };

  const commitRename = () => {
    const next = commitPlateTitle(titleDraft);
    setProjectTitle(next);
    setEditingTitle(false);
    if (next !== resolvedTitle) {
      notify.success('Plate renamed', next);
    }
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const refreshCloudProjects = useDebouncedCallback(
    () => {
      listCloudProjects()
        .then(setCloudProjects)
        .catch(() => setCloudProjects([]));
    },
    { wait: 250, leading: true, trailing: false }
  );

  const toggle = (id: MenuId) => {
    setActiveMenu((m) => {
      const next = m === id ? null : id;
      if (next === 'file') {
        refreshCloudProjects();
      }
      return next;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    close();
    if (!files.length) return;
    const loaded = await loadImageFiles(files);
    for (const img of loaded) {
      addImageLayer(img.src, img.name, img.width, img.height);
    }
    if (loaded.length) onFitToScreen();
  };

  const handleProjectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      loadProject(await readProjectFile(file));
      notify.success('Project opened', file.name);
    } catch (err) {
      notify.error(
        'Could not open project',
        err instanceof Error ? err.message : 'Invalid project file'
      );
    }
    e.target.value = '';
    close();
  };

  const handlePsdFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    close();
    if (!file) return;
    try {
      const psd = await importPsdFile(file);
      createBlankDocument(psd.width, psd.height, '#ffffff');
      setProjectTitle(psd.title);
      for (const layer of psd.layers) {
        addImageLayer(layer.src, layer.name, layer.width, layer.height);
        const id = useEditorStore.getState().selectedLayerId;
        if (!id) continue;
        updateLayer(id, {
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
          opacity: layer.opacity,
          visible: layer.visible,
        });
      }
      // addImageLayer sizes the canvas to the first layer; restore the PSD canvas.
      // Importing is a fresh document, so drop the per-layer history entries too.
      useEditorStore.setState({
        canvasWidth: psd.width,
        canvasHeight: psd.height,
        past: [],
        future: [],
      });
      onFitToScreen();
      notify.success('PSD imported', `${psd.layers.length} layers · ${psd.width}×${psd.height}`);
    } catch (err) {
      notify.error(
        'Could not open PSD',
        err instanceof Error ? err.message : 'Import failed'
      );
    }
  };

  const handleSmartObjectReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    close();
    if (!files.length) return;
    const [loaded] = await loadImageFiles(files.slice(0, 1));
    if (loaded) replaceSmartObjectSource(loaded.src, loaded.width, loaded.height);
  };

  const handleLoadSample = (sampleId: string) => {
    void findSampleImage(sampleId).then((sample) => {
      if (!sample) return;
      addImageLayer(sample.dataUrl, sample.name, sample.width, sample.height);
      close();
    });
  };
  const renderMenu = (id: (typeof MENU_BUTTONS)[number]['id']) => {
    switch (id) {
      case 'file':
        return (
          <FileMenu
            onClose={close}
            cloudProjects={cloudProjects}
            onPlaceImage={() => fileInputRef.current?.click()}
            onOpenPsd={() => psdInputRef.current?.click()}
            onOpenProject={() => projectInputRef.current?.click()}
            onRename={beginRename}
            onLoadSample={handleLoadSample}
          />
        );
      case 'edit':
        return <EditMenu onClose={close} />;
      case 'image':
        return <ImageMenu onClose={close} />;
      case 'layer':
        return (
          <LayerMenu
            onClose={close}
            onReplaceSmartObject={() => smartObjectInputRef.current?.click()}
          />
        );
      case 'select':
        return <SelectMenu onClose={close} />;
      case 'filter':
        return <FilterMenu onClose={close} />;
      case 'view':
        return <ViewMenu onClose={close} onFitToScreen={onFitToScreen} />;
    }
  };

  return (
    <header
      ref={barRef}
      className="shell-nav relative z-[80] h-12 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] px-2.5 flex items-center gap-2 select-none"
      data-tour="tour-nav"
      aria-label="Editor toolbar"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={projectInputRef}
        type="file"
        accept={`.json,${PROJECT_FILE_EXTENSION},application/json`}
        className="hidden"
        onChange={handleProjectFileChange}
      />

      <input
        ref={psdInputRef}
        type="file"
        accept=".psd,image/vnd.adobe.photoshop"
        className="hidden"
        onChange={handlePsdFileChange}
      />
      <input
        ref={smartObjectInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={handleSmartObjectReplace}
      />

      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to="/"
          title="Home"
          aria-label="PhotoshopLite home"
          className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hot)] flex items-center justify-center font-display font-extrabold text-[#1a1208] text-[11px] no-underline transition-colors focus-visible:outline-2 focus-visible:outline-[var(--text-primary)]"
        >
          Ps
        </Link>
        <span className="hidden lg:inline font-display font-bold text-[13px] text-[var(--text-primary)] tracking-tight leading-none">
          Photoshop<span className="text-[var(--accent-hot)]">Lite</span>
        </span>
      </div>

      <div className="nav-sep" aria-hidden />

      {/* Document name */}
      {editingTitle ? (
        <input
          ref={titleInputRef}
          data-tour="tour-project-title"
          value={titleDraft}
          placeholder="Name this plate…"
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setEditingTitle(false);
          }}
          className="doc-plate-input"
          aria-label="Plate name"
          maxLength={80}
        />
      ) : (
        <button
          type="button"
          data-tour="tour-project-title"
          data-unnamed={isUnnamed ? 'true' : 'false'}
          title="Click to rename"
          aria-label={
            isUnnamed
              ? 'Name this plate — currently untitled'
              : `Rename plate, current name ${resolvedTitle}`
          }
          onClick={beginRename}
          className="doc-plate-btn"
        >
          <span className="doc-plate-btn__tag">Plate</span>
          <span className="doc-plate-btn__name">
            {isUnnamed ? 'Name this plate…' : resolvedTitle}
          </span>
          <Pencil size={11} strokeWidth={2} animated={false} className="doc-plate-btn__pen" aria-hidden />
        </button>
      )}

      <div className="nav-sep" aria-hidden />

      {/* Photoshop-style menus */}
      <nav className="flex items-center gap-0.5 shrink-0" aria-label="Application menus">
        {MENU_BUTTONS.map(({ id, label, accent }) => (
          <div key={id} className="relative">
            <MenuBtn
              active={activeMenu === id}
              onClick={() => toggle(id)}
              accent={accent}
              label={label}
            >
              {label}
            </MenuBtn>
            {activeMenu === id && renderMenu(id)}
          </div>
        ))}
      </nav>

      <div className="flex-1 min-w-2" />

      {/* Action dock — History · Zoom · Lab · Export */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="dock-rail hidden sm:flex" role="toolbar" aria-label="History">
          <button
            type="button"
            disabled={past.length === 0}
            onClick={undo}
            title="Undo (⌘Z)"
            aria-label="Undo"
            className="dock-btn dock-btn-icon"
          >
            <Undo2 size={14} aria-hidden />
          </button>
          <button
            type="button"
            disabled={future.length === 0}
            onClick={redo}
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
            className="dock-btn dock-btn-icon"
          >
            <Redo2 size={14} aria-hidden />
          </button>
        </div>

        <div className="dock-rail hidden sm:flex" role="toolbar" aria-label="Zoom">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))}
            title="Zoom out (⌘-)"
            aria-label="Zoom out"
            className="dock-btn dock-btn-icon"
          >
            <ZoomOut size={13} aria-hidden />
          </button>
          <button
            type="button"
            title="Reset to 100% (⌘1)"
            aria-label={`Zoom ${Math.round(zoom * 100)} percent, reset to 100 percent`}
            onClick={() => setZoom(1)}
            className="dock-zoom-value"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(8, z * 1.2))}
            title="Zoom in (⌘=)"
            aria-label="Zoom in"
            className="dock-btn dock-btn-icon"
          >
            <ZoomIn size={13} aria-hidden />
          </button>
          <div className="dock-split" aria-hidden />
          <button
            type="button"
            onClick={onFitToScreen}
            title="Fit to screen (⌘0)"
            aria-label="Fit to screen"
            className="dock-btn dock-btn-icon"
          >
            <Maximize2 size={13} aria-hidden />
          </button>
        </div>

        <div className="dock-rail" role="toolbar" aria-label="Neural lab actions">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Place image"
            aria-label="Place image"
            className="dock-btn"
          >
            <FolderOpen size={13} aria-hidden />
            <span className="hidden lg:inline">Place</span>
          </button>
          <button
            type="button"
            onClick={() => handleLoadSample('sample-portrait')}
            title="Load demo photo"
            aria-label="Load demo photo"
            className="dock-btn hidden md:inline-flex"
          >
            <ImageIcon size={13} aria-hidden />
            <span className="hidden lg:inline">Demo</span>
          </button>

          <div className="dock-split" aria-hidden />

          <div className="relative flex items-center">
            <button
              type="button"
              disabled={aiStatus.isProcessing || !layers.some((l) => l.type === 'image')}
              onClick={() => runRevive('natural')}
              title="Photo Revive"
              aria-label="Photo Revive"
              className="dock-btn dock-btn-ai"
            >
              <SunMedium size={13} aria-hidden />
              <span className="hidden md:inline">Revive</span>
            </button>
            <button
              type="button"
              onClick={() => toggle('revive')}
              className="dock-btn dock-btn-icon dock-btn-ai"
              title="Revive modes"
              aria-label="Revive modes"
              aria-expanded={activeMenu === 'revive'}
              aria-haspopup="menu"
            >
              <ChevronDown size={12} aria-hidden />
            </button>
            <AnimatedMenu
              open={activeMenu === 'revive'}
              onClose={close}
              origin="tr"
              widthClass="w-48"
              closeOnLeave={false}
              className="top-full right-0 mt-1 z-[100]"
            >
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
            </AnimatedMenu>
          </div>

          <div className="relative flex items-center">
            <button
              type="button"
              disabled={aiStatus.isProcessing || !layers.some((l) => l.type === 'image')}
              onClick={() => runCleanup('standard')}
              title="Photo Cleanup"
              aria-label="Photo Cleanup"
              className="dock-btn dock-btn-cool"
            >
              <Eraser size={13} aria-hidden />
              <span className="hidden md:inline">Clean</span>
            </button>
            <button
              type="button"
              onClick={() => toggle('cleanup')}
              className="dock-btn dock-btn-icon dock-btn-cool"
              title="Cleanup modes"
              aria-label="Cleanup modes"
              aria-expanded={activeMenu === 'cleanup'}
              aria-haspopup="menu"
            >
              <ChevronDown size={12} aria-hidden />
            </button>
            <AnimatedMenu
              open={activeMenu === 'cleanup'}
              onClose={close}
              origin="tr"
              widthClass="w-48"
              closeOnLeave={false}
              className="top-full right-0 mt-1 z-[100]"
            >
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
            </AnimatedMenu>
          </div>

          <button
            type="button"
            disabled={aiStatus.isProcessing || !layers.some((l) => l.type === 'image')}
            onClick={() => {
              const id = resolveImageId();
              if (id) {
                selectLayer(id);
                removeBackground(id);
              }
            }}
            title="Remove background"
            aria-label="Remove background"
            className="dock-btn dock-btn-cutout"
          >
            <Scissors size={13} aria-hidden />
            <span className="hidden lg:inline">Cutout</span>
          </button>

          <div className="dock-split hidden xl:block" aria-hidden />

          <button
            type="button"
            disabled={!selectedLayerId}
            onClick={() => selectedLayerId && duplicateLayer(selectedLayerId)}
            title="Duplicate layer (⌘D)"
            aria-label="Duplicate layer"
            className="dock-btn dock-btn-icon hidden xl:inline-flex"
          >
            <Copy size={13} aria-hidden />
          </button>
          <button
            type="button"
            disabled={!selectedLayer}
            onClick={() => flip('h')}
            title="Flip horizontal"
            aria-label="Flip horizontal"
            className="dock-btn dock-btn-icon hidden xl:inline-flex"
          >
            <FlipHorizontal size={13} aria-hidden />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setExportModalOpen(true)}
          title="Export (⌘E)"
          aria-label="Export image"
          className="dock-export"
        >
          <Download size={13} strokeWidth={2.4} aria-hidden />
          Export
        </button>
      </div>
    </header>
  );
};

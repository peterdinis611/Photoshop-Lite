import React from 'react';
import {
  FilePlus,
  FolderOpen,
  FileImage,
  Images,
  ClipboardPaste,
  Pencil,
  Save,
  Cloud,
  Image as ImageIcon,
  Download,
  Shapes,
} from 'lucide-react';
import type { ProjectSummaryDto } from '@photoshop-lite/shared-types';
import { useEditorStore } from '../../../store/editorStore';
import { SAMPLE_IMAGES } from '../../../assets/sampleImages';
import { MenuItem as Item, MenuLabel as Label, MenuSep as Sep } from '../../ui/AnimatedMenu';
import { MenuPanel } from './MenuPanel';

interface FileMenuProps {
  onClose: () => void;
  cloudProjects: ProjectSummaryDto[];
  onPlaceImage: () => void;
  onOpenPsd: () => void;
  onOpenProject: () => void;
  onRename: () => void;
  onLoadSample: (sampleId: string) => void;
}

export const FileMenu: React.FC<FileMenuProps> = ({
  onClose,
  cloudProjects,
  onPlaceImage,
  onOpenPsd,
  onOpenProject,
  onRename,
  onLoadSample,
}) => {
  const {
    setNewCanvasModalOpen,
    setStockModalOpen,
    setIconifyModalOpen,
    setExportModalOpen,
    saveProject,
    saveProjectToCloud,
    loadProjectFromCloud,
    addImageLayer,
  } = useEditorStore();

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('decode failed'));
          img.src = url;
        });
        addImageLayer(url, 'Pasted image', img.naturalWidth, img.naturalHeight);
        onClose();
        return;
      }
    } catch {
      /* permission denied or empty */
    }
  };

  return (
    <MenuPanel onClose={onClose}>
      <Item onClick={() => { setNewCanvasModalOpen(true); onClose(); }} hint="⌘N">
        <FilePlus size={13} /> New…
      </Item>
      <Item onClick={onPlaceImage} hint="⌘O">
        <FolderOpen size={13} /> Place Image…
      </Item>
      <Item onClick={onOpenPsd}>
        <FileImage size={13} /> Open PSD…
      </Item>
      <Item
        onClick={() => {
          setStockModalOpen(true);
          onClose();
        }}
      >
        <Images size={13} /> Stock & CC Photos…
      </Item>
      <Item
        onClick={() => {
          setIconifyModalOpen(true);
          onClose();
        }}
      >
        <Shapes size={13} /> Iconify Icons…
      </Item>
      <Item onClick={() => { void pasteFromClipboard(); }} hint="⌘V">
        <ClipboardPaste size={13} /> Paste Image…
      </Item>
      <Item onClick={onOpenProject}>
        <FolderOpen size={13} /> Open Project…
      </Item>
      <Item
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        <Pencil size={13} /> Rename Project…
      </Item>
      <Item onClick={() => { saveProject(); onClose(); }} hint="⌘S">
        <Save size={13} /> Save Project
      </Item>
      <Item
        onClick={async () => {
          try {
            await saveProjectToCloud();
          } catch {
            /* toast via aiStatus */
          }
          onClose();
        }}
        hint="⌘⇧S"
      >
        <Cloud size={13} /> Save to Cloud
      </Item>
      <div className="px-3 pb-1 text-[10px] leading-snug text-[var(--text-faint)]">
        Needs the API running · status appears bottom-right
      </div>
      <Sep />
      <Label>Cloud projects</Label>
      {cloudProjects.length === 0 ? (
        <div className="px-3 py-1.5 text-[11px] text-[var(--text-faint)]">
          Nothing in the cloud yet — use Save to Cloud, or start the API if it’s offline.
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
              onClose();
            }}
          >
            <Cloud size={13} /> {p.title}
          </Item>
        ))
      )}
      <Sep />
      <Label>Samples</Label>
      {SAMPLE_IMAGES.map((s) => (
        <Item key={s.id} onClick={() => onLoadSample(s.id)}>
          <ImageIcon size={13} /> {s.name}
        </Item>
      ))}
      <Sep />
      <Item onClick={() => { setExportModalOpen(true); onClose(); }} hint="⌘E">
        <Download size={13} /> Export As…
      </Item>
    </MenuPanel>
  );
};

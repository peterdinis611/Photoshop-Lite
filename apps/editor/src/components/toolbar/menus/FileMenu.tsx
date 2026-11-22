import React, { useEffect, useState } from 'react';
import {
  FilePlus,
  FolderOpen,
  FileImage,
  Images,
  ClipboardPaste,
  Pencil,
  Save,
  Cloud,
  History,
  Link2,
  Image as ImageIcon,
  Download,
  Shapes,
} from 'pulsoicon-react';
import type { ProjectSummaryDto } from '@photoshop-lite/shared-types';
import { useEditorStore } from '../../../store/editorStore';
import { loadSampleImages, type SampleImage } from '../../../assets/loadSampleImages';
import { downloadPsdBlob, exportPsdPartial } from '../../../utils/psdExport';
import { notify } from '../../../utils/notify';
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
    setVersionHistoryModalOpen,
    saveProject,
    saveProjectToCloud,
    loadProjectFromCloud,
    shareCloudProjectLink,
    cloudProjectId,
    projectTitle,
    canvasWidth,
    canvasHeight,
    layers,
    addImageLayer,
  } = useEditorStore();

  const [samples, setSamples] = useState<SampleImage[]>([]);
  useEffect(() => {
    void loadSampleImages().then(setSamples);
  }, []);

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
        <FolderOpen size={13} /> Place Image / Lottie…
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
      <Item
        onClick={() => {
          saveProject();
          notify.success('Project saved');
          onClose();
        }}
        hint="⌘S"
      >
        <Save size={13} /> Save Project
      </Item>
      <Item
        onClick={async () => {
          try {
            await saveProjectToCloud();
            notify.success('Saved to cloud');
          } catch (err) {
            notify.error(
              'Cloud save failed',
              err instanceof Error ? err.message : 'Is the API running?'
            );
          }
          onClose();
        }}
        hint="⌘⇧S"
      >
        <Cloud size={13} /> Save to Cloud
      </Item>
      <Item
        disabled={!cloudProjectId}
        onClick={() => {
          setVersionHistoryModalOpen(true);
          onClose();
        }}
      >
        <History size={13} /> Cloud Revisions…
      </Item>
      <Item
        disabled={!cloudProjectId}
        onClick={async () => {
          const link = shareCloudProjectLink();
          if (link) {
            try {
              await navigator.clipboard.writeText(link);
              notify.success('Share link copied');
            } catch {
              window.prompt('Copy share link', link);
              notify.info('Copy the share link', link);
            }
          } else {
            notify.error('No cloud project', 'Save to Cloud first');
          }
          onClose();
        }}
      >
        <Link2 size={13} /> Copy Share Link
      </Item>
      <div className="px-3 pb-1 text-[10px] leading-snug text-[var(--text-faint)]">
        Needs the API running · toasts appear bottom-right
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
                notify.success('Opened from cloud', p.title);
              } catch (err) {
                notify.error(
                  'Could not open cloud project',
                  err instanceof Error ? err.message : p.title
                );
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
      {samples.map((s) => (
        <Item key={s.id} onClick={() => onLoadSample(s.id)}>
          <ImageIcon size={13} /> {s.name}
        </Item>
      ))}
      <Sep />
      <Item onClick={() => { setExportModalOpen(true); onClose(); }} hint="⌘E">
        <Download size={13} /> Export As…
      </Item>
      <Item
        disabled={!layers.some((l) => l.type === 'image')}
        onClick={async () => {
          try {
            const blob = await exportPsdPartial({
              title: projectTitle || 'Untitled plate',
              width: canvasWidth,
              height: canvasHeight,
              layers,
            });
            downloadPsdBlob(blob, `${(projectTitle || 'artwork').replace(/\s+/g, '-')}.psd`);
          } catch {
            /* ignore */
          }
          onClose();
        }}
      >
        <FileImage size={13} /> Export PSD (images)…
      </Item>
    </MenuPanel>
  );
};

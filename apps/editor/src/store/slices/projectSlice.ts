import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';
import type { ProjectFileData } from '../../types/editor';
import { getErrorMessage, buildProjectFile, downloadProjectFile, extractImageExif, type ImageExifSummary } from '@photoshop-lite/editor-core';
import { aiApiClient } from '@photoshop-lite/editor-ai-client';
import type { ProjectSummaryDto, ProjectVersionSummaryDto } from '@photoshop-lite/shared-types';

export interface ProjectSlice {
  lastExif: ImageExifSummary | null;
  lastCaption: string;
  inspectSelectedExif: () => Promise<void>;
  projectTitle: string;
  cloudProjectId: string | null;
  setProjectTitle: (title: string) => void;
  saveProject: () => void;
  loadProject: (project: ProjectFileData) => void;
  saveProjectToCloud: () => Promise<ProjectSummaryDto>;
  listCloudProjects: () => Promise<ProjectSummaryDto[]>;
  loadProjectFromCloud: (id: string) => Promise<void>;
  listCloudProjectVersions: (id?: string) => Promise<ProjectVersionSummaryDto[]>;
  restoreCloudProjectVersion: (projectId: string, versionId: string) => Promise<void>;
  shareCloudProjectLink: () => string | null;
}

export const createProjectSlice: StateCreator<EditorStore, [], [], ProjectSlice> = (set, get) => ({
  lastExif: null,

  projectTitle: 'Untitled',

  cloudProjectId: null,

  lastCaption: '',

  inspectSelectedExif: async () => {
    const layer = get().layers.find((l) => l.id === get().selectedLayerId);
    if (!layer || layer.type !== 'image') {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: 'Select an image layer for EXIF',
        },
      });
      return;
    }
    try {
      const exif = await extractImageExif(layer.src, { fileName: layer.name });
      set({ lastExif: exif, isExifModalOpen: true });
      if (exif.latitude != null && exif.longitude != null) {
        try {
          const geo = await aiApiClient.reverseGeocode(exif.latitude, exif.longitude);
          if (geo.label) {
            set({
              lastExif: { ...exif, locationLabel: geo.label },
            });
          }
        } catch {
          /* Nominatim optional */
        }
      }
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'EXIF read failed'),
        },
      });
    }
  },

  setProjectTitle: (title) => set({ projectTitle: title }),

  saveProject: () => {
    const { projectTitle, canvasWidth, canvasHeight, backgroundColor, layers } = get();
    const project = buildProjectFile({
      title: projectTitle || 'Untitled',
      canvasWidth,
      canvasHeight,
      backgroundColor,
      layers,
    });
    downloadProjectFile(project);
  },

  loadProject: (project: ProjectFileData) => {
    set({
      projectTitle: project.title || 'Untitled',
      canvasWidth: project.canvasWidth,
      canvasHeight: project.canvasHeight,
      backgroundColor: project.backgroundColor,
      layers: structuredClone(project.layers),
      selectedLayerId: null,
      past: [],
      future: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
      isDocumentOpen: true,
      cropSettings: {
        active: false,
        aspect: 'free',
        x: 0,
        y: 0,
        width: project.canvasWidth,
        height: project.canvasHeight,
        rotation: 0,
      },
      activeTool: 'select',
    });
  },

  saveProjectToCloud: async () => {
    const { projectTitle, canvasWidth, canvasHeight, backgroundColor, layers, cloudProjectId } =
      get();
    const dto = {
      title: projectTitle || 'Untitled',
      canvasWidth,
      canvasHeight,
      backgroundColor,
      layers,
      id: cloudProjectId || undefined,
    };

    set({
      aiStatus: {
        isProcessing: true,
        action: null,
        progress: 40,
        statusText: 'Saving project to API…',
      },
    });

    try {
      const saved = cloudProjectId
        ? await aiApiClient.updateProject(cloudProjectId, dto)
        : await aiApiClient.createProject(dto);

      set({
        cloudProjectId: saved.id,
        projectTitle: saved.title,
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `Saved · ${saved.title}`,
        },
      });
      return saved;
    } catch (e: unknown) {
      const err = getErrorMessage(e, 'Cloud save failed');
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: err,
        },
      });
      throw e;
    }
  },

  listCloudProjects: () => aiApiClient.listProjects(),

  loadProjectFromCloud: async (id) => {
    set({
      aiStatus: {
        isProcessing: true,
        action: null,
        progress: 30,
        statusText: 'Loading cloud project…',
      },
    });
    try {
      const detail = await aiApiClient.getProject(id);
      get().loadProject({
        version: '1.0',
        title: detail.title,
        canvasWidth: detail.canvasWidth,
        canvasHeight: detail.canvasHeight,
        backgroundColor: detail.backgroundColor,
        layers: detail.layers as ProjectFileData['layers'],
        savedAt: detail.savedAt,
      });
      set({
        cloudProjectId: detail.id,
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `Opened · ${detail.title}`,
        },
      });
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Cloud open failed'),
        },
      });
      throw e;
    }
  },

  listCloudProjectVersions: (id) => {
    const projectId = id || get().cloudProjectId;
    if (!projectId) return Promise.resolve([]);
    return aiApiClient.listProjectVersions(projectId);
  },

  restoreCloudProjectVersion: async (projectId, versionId) => {
    set({
      aiStatus: {
        isProcessing: true,
        action: null,
        progress: 35,
        statusText: 'Restoring cloud revision…',
      },
    });
    try {
      const detail = await aiApiClient.restoreProjectVersion(projectId, versionId);
      get().loadProject({
        version: '1.0',
        title: detail.title,
        canvasWidth: detail.canvasWidth,
        canvasHeight: detail.canvasHeight,
        backgroundColor: detail.backgroundColor,
        layers: detail.layers as ProjectFileData['layers'],
        savedAt: detail.savedAt,
      });
      set({
        cloudProjectId: detail.id,
        projectTitle: detail.title,
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 100,
          statusText: `Restored · ${detail.title}`,
        },
      });
    } catch (e: unknown) {
      set({
        aiStatus: {
          isProcessing: false,
          action: null,
          progress: 0,
          statusText: '',
          error: getErrorMessage(e, 'Restore failed'),
        },
      });
      throw e;
    }
  },

  shareCloudProjectLink: () => {
    const id = get().cloudProjectId;
    if (!id || typeof window === 'undefined') return null;
    const url = new URL(window.location.href);
    url.pathname = '/editor';
    url.searchParams.set('cloud', id);
    return url.toString();
  },
});

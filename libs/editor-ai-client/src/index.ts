export {
  AiApiClient,
  aiApiClient,
  getErrorMessage,
} from './apiClient';
export type { WorkspaceIdProvider } from './apiClient';

export {
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_HEADER,
  createWorkspaceId,
  getOrCreateWorkspaceId,
} from './workspaceId';

export {
  executeBackgroundRemoval,
  rasterizeToCanvas,
  smartSegmentBackground,
} from './backgroundRemoval';
export type { BgRemovalOptions } from './backgroundRemoval';

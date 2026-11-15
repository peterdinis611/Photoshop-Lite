import type { ToolType } from '../../../types/editor';
import type { ToolHandler } from './types';

const handlers = new Map<ToolType, ToolHandler>();

/** Register a handler for every tool id it declares (later registrations win). */
export function registerTool(handler: ToolHandler): void {
  const ids = Array.isArray(handler.id) ? handler.id : [handler.id];
  for (const id of ids) handlers.set(id, handler);
}

export function getToolHandler(tool: ToolType): ToolHandler | undefined {
  return handlers.get(tool);
}

export function listRegisteredTools(): ToolType[] {
  return [...handlers.keys()];
}

/** Test helper: drop every registration. */
export function clearToolRegistry(): void {
  handlers.clear();
}

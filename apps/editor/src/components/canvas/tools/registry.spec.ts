import { afterEach, describe, expect, it } from 'vitest';
import { clearToolRegistry, getToolHandler, listRegisteredTools, registerTool } from './registry';
import type { ToolHandler } from './types';

describe('tool registry', () => {
  afterEach(() => clearToolRegistry());

  it('returns the handler registered for a single tool id', () => {
    const handler: ToolHandler = { id: 'brush' };
    registerTool(handler);
    expect(getToolHandler('brush')).toBe(handler);
    expect(getToolHandler('brush')?.id).toBe('brush');
    expect(getToolHandler('eraser')).toBeUndefined();
  });

  it('registers one handler under every id of an array', () => {
    const handler: ToolHandler = { id: ['dodge', 'burn', 'sharpenTool'] };
    registerTool(handler);
    expect(getToolHandler('dodge')).toBe(handler);
    expect(getToolHandler('burn')).toBe(handler);
    expect(getToolHandler('sharpenTool')).toBe(handler);
    expect(listRegisteredTools().sort()).toEqual(['burn', 'dodge', 'sharpenTool']);
  });

  it('lets a later registration replace an earlier one', () => {
    const first: ToolHandler = { id: 'fill' };
    const second: ToolHandler = { id: 'fill' };
    registerTool(first);
    registerTool(second);
    expect(getToolHandler('fill')).toBe(second);
  });
});

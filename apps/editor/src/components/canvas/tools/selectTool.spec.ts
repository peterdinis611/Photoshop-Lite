import { describe, expect, it } from 'vitest';
import './index';
import { getToolHandler, listRegisteredTools } from './registry';

describe('select tool registration', () => {
  it('registers Move (select) alongside hand/zoom', () => {
    const ids = listRegisteredTools();
    expect(ids).toContain('select');
    expect(ids).toContain('hand');
    expect(ids).toContain('zoom');
  });

  it('declines pointer-down so empty-canvas deselect can run', () => {
    const handler = getToolHandler('select');
    expect(handler?.onPointerDown).toBeTypeOf('function');
    // Minimal fake ctx — select only returns false
    const result = handler!.onPointerDown!(
      {
        point: { x: 0, y: 0 },
        evt: {} as MouseEvent,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      },
      {} as never
    );
    expect(result).toBe(false);
  });
});

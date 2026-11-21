import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn((msg: string, opts?: unknown) => ({ id: 's', msg, opts })),
    error: vi.fn((msg: string, opts?: unknown) => ({ id: 'e', msg, opts })),
    message: vi.fn((msg: string, opts?: unknown) => ({ id: 'm', msg, opts })),
    loading: vi.fn((msg: string, opts?: unknown) => ({ id: 'l', msg, opts })),
    dismiss: vi.fn(),
  },
}));

import { toast } from 'sonner';
import { notify } from './notify';

describe('notify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards success / error / info / loading to sonner', () => {
    notify.success('Saved', 'cloud');
    notify.error('Failed', 'boom');
    notify.info('Note');
    notify.loading('Working');

    expect(toast.success).toHaveBeenCalledWith('Saved', { description: 'cloud' });
    expect(toast.error).toHaveBeenCalledWith('Failed', { description: 'boom' });
    expect(toast.message).toHaveBeenCalledWith('Note', { description: undefined });
    expect(toast.loading).toHaveBeenCalledWith('Working', { description: undefined });
  });

  it('uses a stable AI toast id for loading → success → dismiss', () => {
    notify.ai.loading('Cutout', '40%');
    expect(toast.loading).toHaveBeenCalledWith('Cutout', {
      id: notify.ai.id,
      description: '40%',
    });

    notify.ai.success('Done', 'Layer ready');
    expect(toast.success).toHaveBeenCalledWith('Done', {
      id: notify.ai.id,
      description: 'Layer ready',
    });

    notify.ai.error('Failed', 'timeout');
    expect(toast.error).toHaveBeenCalledWith('Failed', {
      id: notify.ai.id,
      description: 'timeout',
    });

    notify.ai.dismiss();
    expect(toast.dismiss).toHaveBeenCalledWith(notify.ai.id);
  });
});

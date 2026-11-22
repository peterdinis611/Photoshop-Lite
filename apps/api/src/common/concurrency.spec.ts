import { afterEach, describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import {
  ConcurrencyGate,
  getAiConcurrencyGate,
  resetAiConcurrencyGate,
} from './concurrency';

describe('ConcurrencyGate', () => {
  afterEach(() => {
    delete process.env.AI_MAX_CONCURRENT;
    resetAiConcurrencyGate();
  });

  it('allows up to max concurrent jobs then rejects', async () => {
    const gate = new ConcurrencyGate(1);
    let release!: () => void;
    const blocker = new Promise<void>((r) => {
      release = r;
    });

    const first = gate.run(() => blocker.then(() => 'ok'));
    await expect(gate.run(async () => 'nope')).rejects.toBeInstanceOf(HttpException);
    release();
    await expect(first).resolves.toBe('ok');
    await expect(gate.run(async () => 'again')).resolves.toBe('again');
  });

  it('getAiConcurrencyGate reads AI_MAX_CONCURRENT', async () => {
    process.env.AI_MAX_CONCURRENT = '1';
    resetAiConcurrencyGate();
    const gate = getAiConcurrencyGate();
    let release!: () => void;
    const blocker = new Promise<void>((r) => {
      release = r;
    });
    const first = gate.run(() => blocker.then(() => 1));
    await expect(gate.run(async () => 2)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OVERLOADED' }),
    });
    release();
    await first;
  });
});

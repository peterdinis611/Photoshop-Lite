import { describe, expect, it } from 'vitest';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns a public ok probe without secrets', () => {
    const health = new HealthService().getHealth();
    expect(health.status).toBe('ok');
    expect(health.service).toMatch(/NestJS/i);
    expect(health.version).toBeTruthy();
    expect(health.timestamp).toMatch(/^\d{4}-/);
    expect(JSON.stringify(health)).not.toMatch(/api[_-]?key|secret|token/i);
  });
});

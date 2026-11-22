import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { WORKSPACE_HEADER } from './workspace';

/**
 * Rate-limit key:
 * - Prefer X-Workspace-Id so people on the same café Wi‑Fi don't share one bucket
 * - Fall back to IP when the header is absent (public reads)
 *
 * Combined with per-workspace storage quotas this keeps noisy tenants isolated
 * without requiring login.
 */
@Injectable()
export class WorkspaceThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const raw = req.headers[WORKSPACE_HEADER] ?? req.headers['x-workspace-id'];
    const header = Array.isArray(raw) ? raw[0] : raw;
    const ws = typeof header === 'string' ? header.trim() : '';
    if (ws.length >= 8 && ws.length <= 80 && /^[a-zA-Z0-9_-]+$/.test(ws)) {
      return `ws:${ws}`;
    }
    const ip =
      (typeof req.ip === 'string' && req.ip) ||
      req.socket?.remoteAddress ||
      'unknown';
    return `ip:${ip}`;
  }
}

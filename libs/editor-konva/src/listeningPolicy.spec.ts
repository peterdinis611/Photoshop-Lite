import { describe, expect, it } from 'vitest';
import { listeningPolicy } from './listeningPolicy';

describe('listeningPolicy', () => {
  it('allows content + overlay hits in select mode (Move + Transformer)', () => {
    const p = listeningPolicy('select');
    expect(p.contentListening).toBe(true);
    expect(p.overlayListening).toBe(true);
  });

  it('disables content hits for zoom (click-to-zoom, not layer drag)', () => {
    const p = listeningPolicy('zoom');
    expect(p.contentListening).toBe(false);
    expect(p.cursor).toBe('zoom-in');
  });

  it('does not fall through to contentListening for unknown tools', () => {
    expect(listeningPolicy('beforeAfter').contentListening).toBe(false);
  });

  it('disables content hits for brush / crop', () => {
    expect(listeningPolicy('brush').contentListening).toBe(false);
    expect(listeningPolicy('crop').overlayListening).toBe(true);
    expect(listeningPolicy('crop').cursor).toBe('crosshair');
  });

  it('treats spotHealing like other retouch tools', () => {
    expect(listeningPolicy('spotHealing').contentListening).toBe(false);
    expect(listeningPolicy('spotHealing').cursor).toBe('crosshair');
  });

  it('treats new paint/selection tools as crosshair tools', () => {
    for (const tool of ['gradient', 'dodge', 'burn', 'sharpenTool', 'polyLasso', 'magneticLasso', 'quickSelect', 'healing', 'patch', 'liquify']) {
      const p = listeningPolicy(tool);
      expect(p.contentListening).toBe(false);
      expect(p.cursor).toBe('crosshair');
    }
  });

  it('keeps the overlay interactive for the transform tool', () => {
    expect(listeningPolicy('transform').overlayListening).toBe(true);
    expect(listeningPolicy('transform').contentListening).toBe(false);
  });

  it('uses grab cursor for hand tool', () => {
    expect(listeningPolicy('hand').cursor).toBe('grab');
  });
});

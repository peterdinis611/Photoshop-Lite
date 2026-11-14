import { describe, expect, it } from 'vitest';
import { listeningPolicy } from './listeningPolicy';

describe('listeningPolicy', () => {
  it('allows content hits in select mode', () => {
    const p = listeningPolicy('select');
    expect(p.contentListening).toBe(true);
    expect(p.overlayListening).toBe(false);
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

  it('uses grab cursor for hand tool', () => {
    expect(listeningPolicy('hand').cursor).toBe('grab');
  });
});

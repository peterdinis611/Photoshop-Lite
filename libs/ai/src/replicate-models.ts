/**
 * Replicate model refs (owner/name). Predictions use
 * POST /v1/models/{owner}/{name}/predictions.
 */
export const REPLICATE_MODEL_REFS = {
  upscale: 'nightmareai/real-esrgan',
  cleanup: 'jingyunliang/swinir',
  revive: 'piddnad/ddcolor',
  faceRestore: 'sczhou/codeformer',
  inpaint: 'stability-ai/stable-diffusion-inpainting',
  segment: 'schananas/grounded_sam',
  caption: 'salesforce/blip',
  /** Shared img2img-ish model; prompt varies by style preset */
  style: 'lucataco/sdxl-lightning-4step',
} as const;

/** Known-good version pin for Real-ESRGAN (existing upscale path). */
export const REAL_ESRGAN_VERSION =
  '42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b';

export type StyleKey = 'film' | 'sketch' | 'anime' | 'watercolor' | 'noir';

export function styleModelRef(_style: StyleKey): string {
  return REPLICATE_MODEL_REFS.style;
}

export type { SampleImage } from './sampleImages';

/** Dynamic import so sample SVG payloads stay out of the landing / cold path. */
export async function loadSampleImages() {
  const mod = await import('./sampleImages');
  return mod.SAMPLE_IMAGES;
}

export async function findSampleImage(id: string) {
  const samples = await loadSampleImages();
  return samples.find((s) => s.id === id);
}

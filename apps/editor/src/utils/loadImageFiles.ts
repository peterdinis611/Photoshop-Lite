const IMAGE_MIME = /^image\//i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|svg|heic|heif|tif{1,2})$/i;

export function isImageFile(file: File): boolean {
  if (file.type && IMAGE_MIME.test(file.type)) return true;
  return IMAGE_EXT.test(file.name);
}

export function collectImageFiles(fileList: FileList | File[] | null | undefined): File[] {
  if (!fileList) return [];
  return Array.from(fileList).filter(isImageFile);
}

export function dragEventHasFiles(e: { dataTransfer?: DataTransfer | null }): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}

export interface LoadedImageFile {
  src: string;
  name: string;
  width: number;
  height: number;
  file: File;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function probeImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Invalid image'));
    img.src = src;
  });
}

export async function loadImageFile(file: File): Promise<LoadedImageFile> {
  const src = await readFileAsDataUrl(file);
  const { width, height } = await probeImage(src);
  return {
    src,
    name: file.name.replace(/\.[^/.]+$/, '') || 'Image',
    width,
    height,
    file,
  };
}

export async function loadImageFiles(files: File[]): Promise<LoadedImageFile[]> {
  const images = collectImageFiles(files);
  const results = await Promise.allSettled(images.map(loadImageFile));
  return results
    .filter((r): r is PromiseFulfilledResult<LoadedImageFile> => r.status === 'fulfilled')
    .map((r) => r.value);
}

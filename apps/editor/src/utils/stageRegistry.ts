import type Konva from 'konva';

let stage: Konva.Stage | null = null;

export function registerStage(next: Konva.Stage | null): void {
  stage = next;
}

export function getStage(): Konva.Stage | null {
  return stage;
}

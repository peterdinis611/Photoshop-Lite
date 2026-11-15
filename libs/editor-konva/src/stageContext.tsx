import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';
import type Konva from 'konva';

interface StageContextValue {
  stage: Konva.Stage | null;
  setStage: (stage: Konva.Stage | null) => void;
  findById: <T extends Konva.Node = Konva.Node>(id: string) => T | undefined;
}

const StageContext = createContext<StageContextValue | null>(null);

/** Module singleton so non-React helpers (export) can still reach the stage. */
let registryStage: Konva.Stage | null = null;

export function registerStage(next: Konva.Stage | null): void {
  registryStage = next;
}

export function getStage(): Konva.Stage | null {
  return registryStage;
}

export const KonvaStageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stage, setStageState] = useState<Konva.Stage | null>(null);

  const setStage = useCallback((next: Konva.Stage | null) => {
    registerStage(next);
    setStageState(next);
  }, []);

  const value = useMemo<StageContextValue>(
    () => ({
      stage,
      setStage,
      findById: <T extends Konva.Node = Konva.Node>(id: string) =>
        stage?.findOne<T>(`#${id}`) ?? undefined,
    }),
    [setStage, stage]
  );

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
};

export function useKonvaStage(): StageContextValue {
  const ctx = useContext(StageContext);
  if (!ctx) {
    return {
      stage: getStage(),
      setStage: registerStage,
      findById: <T extends Konva.Node = Konva.Node>(id: string) =>
        getStage()?.findOne<T>(`#${id}`) ?? undefined,
    };
  }
  return ctx;
}

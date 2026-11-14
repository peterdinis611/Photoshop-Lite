import React, { createContext, useContext, useCallback, useMemo, useRef } from 'react';
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
  const stageRef = useRef<Konva.Stage | null>(null);
  const [, bump] = React.useState(0);

  const setStage = useCallback((stage: Konva.Stage | null) => {
    stageRef.current = stage;
    registerStage(stage);
    bump((n) => n + 1);
  }, []);

  const value = useMemo<StageContextValue>(
    () => ({
      stage: stageRef.current,
      setStage,
      findById: <T extends Konva.Node = Konva.Node>(id: string) =>
        stageRef.current?.findOne<T>(`#${id}`) ?? undefined,
    }),
    [setStage, stageRef.current]
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

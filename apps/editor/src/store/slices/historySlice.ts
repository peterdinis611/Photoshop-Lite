import type { StateCreator } from 'zustand';
import type { EditorStore } from '../types';
import type { HistorySnapshot } from '../../types/editor';
import { cloneLayersForHistory } from '@photoshop-lite/editor-core';
import { MAX_HISTORY } from '../helpers';

export interface HistorySlice {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  commitHistory: (actionName: string) => void;
  undo: () => void;
  redo: () => void;
  jumpToHistoryStep: (snapshotId: string) => void;
}

export const createHistorySlice: StateCreator<EditorStore, [], [], HistorySlice> = (set, get) => ({
  past: [],

  future: [],

  commitHistory: (actionName) => {
    const { layers, canvasWidth, canvasHeight, backgroundColor, past } = get();

    const newSnapshot: HistorySnapshot = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: actionName,
      timestamp: Date.now(),
      layers: cloneLayersForHistory(layers),
      canvasWidth,
      canvasHeight,
      backgroundColor,
    };

    set({
      past: [...past.slice(-(MAX_HISTORY - 1)), newSnapshot],
      future: [],
    });
  },

  undo: () => {
    const { past, future, layers, canvasWidth, canvasHeight, backgroundColor } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    const currentSnapshot: HistorySnapshot = {
      id: `${Date.now()}_curr`,
      name: 'Current State',
      timestamp: Date.now(),
      layers: cloneLayersForHistory(layers),
      canvasWidth,
      canvasHeight,
      backgroundColor,
    };

    set({
      layers: previous.layers,
      canvasWidth: previous.canvasWidth,
      canvasHeight: previous.canvasHeight,
      backgroundColor: previous.backgroundColor,
      past: newPast,
      future: [currentSnapshot, ...future],
      selectedLayerId: previous.layers.length > 0 ? previous.layers[previous.layers.length - 1].id : null,
    });
  },

  redo: () => {
    const { past, future, layers, canvasWidth, canvasHeight, backgroundColor } = get();
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);

    const currentSnapshot: HistorySnapshot = {
      id: `${Date.now()}_curr`,
      name: 'Current State',
      timestamp: Date.now(),
      layers: cloneLayersForHistory(layers),
      canvasWidth,
      canvasHeight,
      backgroundColor,
    };

    set({
      layers: next.layers,
      canvasWidth: next.canvasWidth,
      canvasHeight: next.canvasHeight,
      backgroundColor: next.backgroundColor,
      past: [...past, currentSnapshot],
      future: newFuture,
      selectedLayerId: next.layers.length > 0 ? next.layers[next.layers.length - 1].id : null,
    });
  },

  jumpToHistoryStep: (snapshotId) => {
    const { past, future, layers, canvasWidth, canvasHeight, backgroundColor } = get();
    const index = past.findIndex((s) => s.id === snapshotId);
    if (index === -1) return;

    const target = past[index];
    const currentSnapshot: HistorySnapshot = {
      id: `${Date.now()}_curr`,
      name: 'State before jump',
      timestamp: Date.now(),
      layers: cloneLayersForHistory(layers),
      canvasWidth,
      canvasHeight,
      backgroundColor,
    };

    const newPast = past.slice(0, index);
    const movedToFuture = [...past.slice(index + 1), currentSnapshot, ...future];

    set({
      layers: target.layers,
      canvasWidth: target.canvasWidth,
      canvasHeight: target.canvasHeight,
      backgroundColor: target.backgroundColor,
      past: newPast,
      future: movedToFuture,
      selectedLayerId: target.layers.length > 0 ? target.layers[target.layers.length - 1].id : null,
    });
  },
});

import React from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { OptHint, SizeOpt } from '../../ui/OptionControls';

interface HealingOptionsProps {
  tool: 'healing' | 'patch';
}

/** Healing brush / patch tool. */
export const HealingOptions: React.FC<HealingOptionsProps> = ({ tool }) => {
  const brushSettings = useEditorStore((s) => s.brushSettings);
  const updateBrushSettings = useEditorStore((s) => s.updateBrushSettings);

  return (
    <div className="flex items-center gap-3">
      <SizeOpt
        label="Size"
        value={brushSettings.size}
        min={2}
        max={150}
        unit="px"
        onCommit={(size) => updateBrushSettings({ size })}
        widthClass="w-24"
      />
      <SizeOpt
        label="Hardness"
        value={brushSettings.hardness}
        min={0}
        max={1}
        step={0.05}
        onCommit={(hardness) => updateBrushSettings({ hardness })}
      />
      <OptHint>
        {tool === 'healing'
          ? 'Alt+click source · drag to heal'
          : 'Draw an area · drag it onto clean texture'}
      </OptHint>
    </div>
  );
};

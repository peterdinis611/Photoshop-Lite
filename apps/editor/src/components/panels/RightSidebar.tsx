import React, { Activity, Suspense, lazy, startTransition, useState, ViewTransition } from 'react';
import { Layers, Sliders, Sparkles, Palette, History } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

const LayersPanel = lazy(() =>
  import('./LayersPanel').then((m) => ({ default: m.LayersPanel }))
);
const AdjustmentsPanel = lazy(() =>
  import('./AdjustmentsPanel').then((m) => ({ default: m.AdjustmentsPanel }))
);
const AISuitePanel = lazy(() =>
  import('./AISuitePanel').then((m) => ({ default: m.AISuitePanel }))
);
const StylesPanel = lazy(() =>
  import('./StylesPanel').then((m) => ({ default: m.StylesPanel }))
);
const HistoryPanel = lazy(() =>
  import('./HistoryPanel').then((m) => ({ default: m.HistoryPanel }))
);

type TabType = 'layers' | 'adjustments' | 'ai' | 'styles' | 'history';

const PanelFallback = () => (
  <div className="p-4 text-[11px] text-[var(--text-faint)] font-mono-ui">Loading panel…</div>
);

const PANELS: { id: TabType; label: string; node: React.ReactNode }[] = [
  { id: 'layers', label: 'Layers', node: <LayersPanel /> },
  { id: 'adjustments', label: 'Tone', node: <AdjustmentsPanel /> },
  { id: 'ai', label: 'Lab', node: <AISuitePanel /> },
  { id: 'styles', label: 'Style', node: <StylesPanel /> },
  { id: 'history', label: 'History', node: <HistoryPanel /> },
];

export const RightSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('layers');
  const [visited, setVisited] = useState<Set<TabType>>(() => new Set(['layers']));
  const { aiStatus } = useEditorStore();

  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: boolean }[] = [
    { id: 'layers', label: 'Layers', icon: <Layers size={15} /> },
    { id: 'adjustments', label: 'Tone', icon: <Sliders size={15} /> },
    {
      id: 'ai',
      label: 'Lab',
      icon: <Sparkles size={15} className="text-[var(--accent-hot)]" />,
      badge: aiStatus.isProcessing,
    },
    { id: 'styles', label: 'Style', icon: <Palette size={15} /> },
    { id: 'history', label: 'History', icon: <History size={15} /> },
  ];

  const selectTab = (id: TabType) => {
    startTransition(() => {
      setVisited((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setActiveTab(id);
    });
  };

  return (
    <aside
      className="shell-sidebar w-80 bg-[var(--bg-panel)] border-l border-[var(--border-subtle)] flex flex-col h-full z-40 select-none"
      data-testid="right-sidebar"
      data-tour="tour-sidebar"
    >
      <div className="flex items-center bg-[var(--bg-app)] border-b border-[var(--border-subtle)] p-1 gap-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => selectTab(tab.id)}
              className={`ui-interactive flex-1 py-1.5 px-1.5 rounded-[var(--radius-sm)] flex items-center justify-center gap-1 text-xs font-medium relative cursor-pointer ${
                isActive
                  ? 'tab-active-ink bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-toolbar)]/60'
              }`}
              title={tab.label}
            >
              {tab.icon}
              <span className="hidden xl:inline text-[10px] truncate font-display font-semibold">
                {tab.label.split(' ')[0]}
              </span>
              {tab.badge && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] absolute top-1 right-1 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden relative">
        <Suspense fallback={<PanelFallback />}>
          {PANELS.map((panel) =>
            visited.has(panel.id) ? (
              <Activity
                key={panel.id}
                mode={activeTab === panel.id ? 'visible' : 'hidden'}
                name={`panel-${panel.id}`}
              >
                <ViewTransition name={`sidebar-${panel.id}`} update="auto">
                  <div className="h-full overflow-y-auto">{panel.node}</div>
                </ViewTransition>
              </Activity>
            ) : null
          )}
        </Suspense>
      </div>
    </aside>
  );
};

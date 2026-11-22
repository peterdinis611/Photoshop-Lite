import React, { Activity, Suspense, lazy, startTransition, useEffect, useState, ViewTransition } from 'react';
import { Layers, Sliders, Sparkles, Palette, History, Film, FolderArchive, PanelRightClose, PanelRightOpen } from 'pulsoicon-react';
import { useEditorStore } from '../../store/editorStore';
import { DarkroomSpinner } from '../ui/DarkroomSpinner';

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
const ActionsPanel = lazy(() =>
  import('./ActionsPanel').then((m) => ({ default: m.ActionsPanel }))
);
const AssetsPanel = lazy(() =>
  import('./AssetsPanel').then((m) => ({ default: m.AssetsPanel }))
);

type TabType = 'layers' | 'adjustments' | 'ai' | 'styles' | 'history' | 'actions' | 'assets';

const STORAGE_KEY = 'px_sidebar_open';

const PanelFallback = () => (
  <div className="flex h-32 items-center justify-center">
    <DarkroomSpinner label="Loading panel" caption="Loading…" />
  </div>
);

const PANELS: { id: TabType; label: string; node: React.ReactNode }[] = [
  { id: 'layers', label: 'Layers', node: <LayersPanel /> },
  { id: 'adjustments', label: 'Tone', node: <AdjustmentsPanel /> },
  { id: 'ai', label: 'Lab', node: <AISuitePanel /> },
  { id: 'styles', label: 'Style', node: <StylesPanel /> },
  { id: 'history', label: 'History', node: <HistoryPanel /> },
  { id: 'actions', label: 'Actions', node: <ActionsPanel /> },
  { id: 'assets', label: 'Assets', node: <AssetsPanel /> },
];

function readOpenPreference(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw !== '0';
  } catch {
    return true;
  }
}

export const RightSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('layers');
  const [visited, setVisited] = useState<Set<TabType>>(() => new Set(['layers']));
  const [isOpen, setIsOpen] = useState(readOpenPreference);
  const [railTip, setRailTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const { aiStatus, isRecordingAction } = useEditorStore();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, isOpen ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [isOpen]);

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
    {
      id: 'actions',
      label: 'Actions',
      icon: <Film size={15} />,
      badge: isRecordingAction,
    },
    { id: 'assets', label: 'Assets', icon: <FolderArchive size={15} /> },
  ];

  const openToTab = (id: TabType) => {
    startTransition(() => {
      setVisited((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setActiveTab(id);
      setIsOpen(true);
    });
  };

  const selectTab = (id: TabType) => {
    // Click active tab again → collapse panel (Photoshop-style)
    if (isOpen && activeTab === id) {
      setIsOpen(false);
      return;
    }
    openToTab(id);
  };

  const toggleOpen = () => {
    if (isOpen) setIsOpen(false);
    else openToTab(activeTab);
  };

  return (
    <aside
      className={`shell-sidebar bg-[var(--bg-panel)] border-l border-[var(--border-subtle)] flex h-full z-40 select-none transition-[width] duration-200 ease-out ${
        isOpen ? 'w-[21.5rem]' : 'w-11'
      }`}
      data-testid="right-sidebar"
      data-tour="tour-sidebar"
      data-open={isOpen ? 'true' : 'false'}
      aria-label="Inspector panels"
    >
      {/* Icon rail — always visible; collapses content */}
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Panel tabs"
        className={`flex flex-col items-center gap-0.5 py-1.5 px-1 border-[var(--border-subtle)] shrink-0 ${
          isOpen ? 'border-r w-11' : 'w-full'
        }`}
      >
        <button
          type="button"
          onClick={toggleOpen}
          title={isOpen ? 'Close panel' : 'Open panel'}
          aria-label={isOpen ? 'Close panel' : 'Open panel'}
          aria-expanded={isOpen}
          className="ui-interactive w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-hot)] hover:bg-[var(--bg-elevated)] cursor-pointer mb-1"
          data-testid="sidebar-toggle"
        >
          {isOpen ? <PanelRightClose size={15} aria-hidden /> : <PanelRightOpen size={15} aria-hidden />}
        </button>

        {tabs.map((tab) => {
          const isActive = isOpen && activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`sidebar-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={isOpen ? `sidebar-panel-${tab.id}` : undefined}
              data-testid={`tab-${tab.id}`}
              onClick={() => selectTab(tab.id)}
              onMouseEnter={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setRailTip({
                  label:
                    isOpen && activeTab === tab.id
                      ? `${tab.label} · close`
                      : tab.label,
                  top: r.top + r.height / 2,
                  left: r.left - 8,
                });
              }}
              onMouseLeave={() => setRailTip(null)}
              className={`ui-interactive relative w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer transition-colors ${
                isActive
                  ? 'bg-[var(--accent-dim)] text-[var(--accent-hot)] border border-[var(--accent)]/40'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-toolbar)]/60'
              }`}
              aria-label={
                tab.badge
                  ? `${tab.label}${tab.id === 'ai' ? ', processing' : ', recording'}`
                  : tab.label
              }
            >
              {tab.icon}
              {tab.badge && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] absolute top-1 right-1 animate-pulse"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {railTip && (
        <div
          className="sidebar-rail-tip font-mono-ui"
          style={{ top: railTip.top, left: railTip.left }}
          role="tooltip"
        >
          {railTip.label}
        </div>
      )}

      {isOpen && (
        <div
          className="flex-1 min-w-0 flex flex-col overflow-hidden"
          role="tabpanel"
          id={`sidebar-panel-${activeTab}`}
          aria-labelledby={`sidebar-tab-${activeTab}`}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-app)]/80">
            <span className="font-display font-bold text-[12px] text-[var(--text-primary)] tracking-tight">
              {tabs.find((t) => t.id === activeTab)?.label ?? 'Panel'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[10px] font-mono-ui uppercase tracking-wider text-[var(--text-faint)] hover:text-[var(--accent-hot)] cursor-pointer px-1.5 py-0.5 rounded hover:bg-[var(--bg-elevated)]"
              title="Close panel"
              aria-label="Close panel"
            >
              Close
            </button>
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
        </div>
      )}
    </aside>
  );
};

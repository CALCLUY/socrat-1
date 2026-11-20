import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  History,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';
import { SessionHistoryItem } from '../types/harness';
import { cn } from '../utils/cn';

interface HistorySidebarProps {
  history: SessionHistoryItem[];
  activeSessionId: string | null;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onNewTopic: () => void;
  onResumeSession: (item: SessionHistoryItem) => void;
  onClearHistory: () => void;
}

const iconButtonClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6B6965] transition-colors hover:bg-[#E8E8E2] hover:text-[#1A1918] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366F1] dark:text-[#A1A09A] dark:hover:bg-[#272724] dark:hover:text-[#EDEDEB]';

function getHistoryGroups(history: SessionHistoryItem[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const groups = [
    { label: 'Today', items: [] as SessionHistoryItem[] },
    { label: 'Yesterday', items: [] as SessionHistoryItem[] },
    { label: 'Previous 7 days', items: [] as SessionHistoryItem[] },
    { label: 'Older', items: [] as SessionHistoryItem[] },
  ];

  for (const item of history) {
    const date = item.updatedAt ?? item.createdAt;
    const index =
      date >= today.getTime()
        ? 0
        : date >= yesterday.getTime()
          ? 1
          : date >= lastWeek.getTime()
            ? 2
            : 3;
    groups[index].items.push(item);
  }

  return groups.filter((group) => group.items.length > 0);
}

export function HistorySidebar({
  history,
  activeSessionId,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
  onNewTopic,
  onResumeSession,
  onClearHistory,
}: HistorySidebarProps) {
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 768px)').matches,
  );
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const focusSearchOnExpand = useRef(false);
  const compact = isDesktop && collapsed;
  const drawerOpen = !isDesktop && mobileOpen;

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const onResize = () => {
      setIsDesktop(media.matches);
      if (media.matches) onCloseMobile();
    };
    media.addEventListener('change', onResize);
    return () => media.removeEventListener('change', onResize);
  }, [onCloseMobile]);

  useEffect(() => {
    if (!compact && focusSearchOnExpand.current) {
      searchRef.current?.focus();
      focusSearchOnExpand.current = false;
    }
  }, [compact]);

  // Keep keyboard focus inside the mobile drawer and restore it on dismissal.
  useEffect(() => {
    if (!drawerOpen) return;
    const activeElement = document.activeElement as HTMLElement | null;
    const previousFocus =
      activeElement && activeElement !== document.body
        ? activeElement
        : document.querySelector<HTMLElement>(
            '[aria-controls="session-sidebar"]',
          );
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() =>
      closeButtonRef.current?.focus({ preventScroll: true }),
    );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseMobile();
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
        ) ?? [],
      ).filter((control) => control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown, true);
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [drawerOpen, onCloseMobile]);

  const filteredHistory = history.filter((item) =>
    `${item.title} ${item.query}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const groups = getHistoryGroups(filteredHistory);

  const startNewTopic = () => {
    setSearch('');
    setConfirmClear(false);
    onNewTopic();
    onCloseMobile();
  };

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onCloseMobile}
        className={cn(
          'fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-250 md:hidden dark:bg-black/60',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        id="session-sidebar"
        ref={sidebarRef}
        role={drawerOpen ? 'dialog' : undefined}
        aria-modal={drawerOpen ? true : undefined}
        aria-label="Session history"
        aria-hidden={!isDesktop && !mobileOpen ? true : undefined}
        inert={!isDesktop && !mobileOpen}
        className={cn(
          'history-sidebar fixed inset-y-0 left-0 z-40 flex h-dvh w-[min(288px,calc(100vw-40px))] flex-col border-r border-[#E5E5E0] bg-[#F3F3EF] transition-[width,translate] duration-250 ease-in-out md:translate-x-0 dark:border-[#2A2A27] dark:bg-[#171715]',
          collapsed ? 'md:w-16' : 'md:w-[232px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className={cn(
            'flex h-12 shrink-0 items-center px-2.5',
            compact ? 'justify-center' : 'justify-between',
          )}
        >
          {!compact && (
            <button
              type="button"
              onClick={startNewTopic}
              aria-label="Socratic home"
              className="flex min-w-0 items-center gap-2.5 rounded-md px-1 text-[#1A1918] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6366F1] dark:text-[#EDEDEB]"
            >
              <BookOpen className="h-[19px] w-[19px] shrink-0 text-[#4338CA] dark:text-[#A5B4FC]" />
              <span className="font-editorial text-[21px] tracking-tight">
                Socratic
              </span>
            </button>
          )}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={drawerOpen ? onCloseMobile : onToggleCollapsed}
            aria-label={
              drawerOpen
                ? 'Close sidebar'
                : collapsed
                  ? 'Expand sidebar'
                  : 'Collapse sidebar'
            }
            title={
              drawerOpen
                ? 'Close sidebar'
                : collapsed
                  ? 'Expand sidebar'
                  : 'Collapse sidebar'
            }
            aria-expanded={drawerOpen || !collapsed}
            aria-controls="sidebar-history"
            className={iconButtonClass}
          >
            {drawerOpen ? (
              <X className="h-[18px] w-[18px]" />
            ) : compact ? (
              <PanelLeftOpen className="h-[18px] w-[18px]" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>

        <div
          className={cn(
            'shrink-0 space-y-1 pb-2 pt-1',
            compact ? 'px-3' : 'px-2.5',
          )}
        >
          <button
            type="button"
            onClick={startNewTopic}
            aria-label="New session"
            title={compact ? 'New session' : undefined}
            className={cn(
              'flex h-9 items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366F1]',
              compact
                ? 'w-10 justify-center text-[#1A1918] hover:bg-[#E8E8E2] dark:text-[#EDEDEB] dark:hover:bg-[#272724]'
                : 'w-full px-2.5 text-[#292824] hover:bg-[#EAEAE3] dark:text-[#EDEDEB] dark:hover:bg-[#232320]',
            )}
          >
            <SquarePen className="h-4 w-4 shrink-0" />
            {!compact && <span>New session</span>}
          </button>

          {compact ? (
            <button
              type="button"
              onClick={() => {
                focusSearchOnExpand.current = true;
                onToggleCollapsed();
              }}
              aria-label="Search session history"
              title="Search session history"
              className={cn(iconButtonClass, 'h-10 w-10')}
            >
              <Search className="h-4 w-4" />
            </button>
          ) : (
            <div className="relative flex items-center">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[#85837C] dark:text-[#85857D]"
              />
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search sessions"
                placeholder="Search sessions"
                className="h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent pr-2 pl-9 text-xs text-[#292824] outline-none transition-colors placeholder:text-[#96938A] hover:bg-[#EAEAE3]/70 focus:bg-[#FBFBFA] dark:text-[#EDEDEB] dark:placeholder:text-[#77776F] dark:hover:bg-[#20201E] dark:focus:bg-[#1B1B19]"
              />
            </div>
          )}
        </div>

        {compact ? (
          <div
            id="sidebar-history"
            className="flex flex-1 flex-col items-center px-3"
          >
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Show saved sessions"
              title="Show saved sessions"
              className={cn(iconButtonClass, 'h-10 w-10')}
            >
              <History className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            id="sidebar-history"
            className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3"
          >
            <div className="flex items-center justify-between px-2.5 pt-2 pb-3">
              <h2 className="text-[11px] font-medium text-[#77756E] dark:text-[#94948B]">
                Your sessions
              </h2>
              {search.trim() && (
                <span className="font-mono-code text-[10px] text-[#96938A] dark:text-[#77776F]">
                  {filteredHistory.length}
                </span>
              )}
            </div>

            {groups.length > 0 ? (
              <nav aria-label="Saved sessions" className="space-y-4">
                {groups.map((group) => (
                  <section key={group.label} aria-label={group.label}>
                    <h3 className="mb-1.5 px-3 text-[10px] font-medium tracking-wide text-[#929087] dark:text-[#77776F]">
                      {group.label}
                    </h3>
                    <ul className="space-y-0.5">
                      {group.items.map((item) => {
                        const answered = item.answered ?? item.total;
                        const completed =
                          item.total > 0 && answered >= item.total;
                        const active = item.id === activeSessionId;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => {
                                onResumeSession(item);
                                setConfirmClear(false);
                                onCloseMobile();
                              }}
                              aria-current={active ? 'page' : undefined}
                              title={item.title}
                              className={cn(
                                'group block w-full min-w-0 rounded-md px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#6366F1]',
                                active
                                  ? 'bg-[#E6E5DE] text-[#1A1918] dark:bg-[#2A2A25] dark:text-[#F1F1ED]'
                                  : 'text-[#45443F] hover:bg-[#EAEAE4] dark:text-[#C5C5BC] dark:hover:bg-[#22221F]',
                              )}
                            >
                              <span
                                className={cn(
                                  'block truncate text-[12.5px] leading-5',
                                  active && 'font-medium',
                                )}
                              >
                                {item.title}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#85837C] dark:text-[#8E8E84]">
                                {completed ? (
                                  <>
                                    <Check
                                      aria-hidden="true"
                                      className="h-3 w-3 text-[#48815C] dark:text-[#7BB98C]"
                                    />
                                    {item.score}/{item.total} correct
                                  </>
                                ) : answered > 0 ? (
                                  <>
                                    {answered} of {item.total} answered
                                  </>
                                ) : (
                                  <>Ready to continue</>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </nav>
            ) : (
              <div className="px-3 pt-5 text-center">
                {search.trim() ? (
                  <Search className="mx-auto mb-3 h-5 w-5 text-[#A1A096] dark:text-[#6E6E65]" />
                ) : (
                  <History className="mx-auto mb-3 h-5 w-5 text-[#A1A096] dark:text-[#6E6E65]" />
                )}
                <p className="text-xs font-medium text-[#6B6965] dark:text-[#A1A09A]">
                  {search.trim()
                    ? 'No matching sessions'
                    : 'A place for your curiosity'}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#929087] dark:text-[#77776F]">
                  {search.trim()
                    ? 'Try another topic or keyword.'
                    : 'Your sessions will appear here.'}
                </p>
                {search.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="mt-3 rounded-md px-2 py-1 text-[11px] text-[#4338CA] hover:underline dark:text-[#A5B4FC]"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!compact && (
          <div className="shrink-0 px-3 py-2">
            {confirmClear ? (
              <div
                className="space-y-2.5"
                role="group"
                aria-label="Confirm clear history"
              >
                <p className="text-xs text-[#6B6965] dark:text-[#A1A09A]">
                  Delete all saved sessions?
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="rounded-md px-1 py-1 text-[11px] text-[#6B6965] hover:text-[#1A1918] dark:text-[#A1A09A] dark:hover:text-white"
                  >
                    Keep sessions
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearHistory();
                      setConfirmClear(false);
                      setSearch('');
                    }}
                    className="rounded-md px-1 py-1 text-[11px] font-medium text-[#B91C1C] hover:underline dark:text-[#F87171]"
                  >
                    Delete all
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  disabled={history.length === 0}
                  aria-label="Clear session history"
                  title="Clear session history"
                  className="rounded-md p-1.5 text-[#929087] transition-colors hover:bg-[#E8E8E2] hover:text-[#B91C1C] disabled:pointer-events-none disabled:opacity-30 dark:text-[#77776F] dark:hover:bg-[#272724] dark:hover:text-[#F87171]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

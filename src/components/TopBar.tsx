import React from 'react';
import { Moon, PanelLeft, SlidersHorizontal, Sun } from 'lucide-react';
import { StudySession } from '../types/harness';

interface TopBarProps {
  session: StudySession | null;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  stageIndex?: number;
  totalStages?: number;
  isDark: boolean;
  mobileSidebarOpen: boolean;
  onToggleTheme: () => void;
  onOpenSidebar: () => void;
  onOpenSettings: () => void;
}

const iconButtonClass =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#73716B] transition-colors hover:bg-[#ECECE6] hover:text-[#1A1918] focus-visible:outline-2 focus-visible:outline-[#6366F1] dark:text-[#A1A09A] dark:hover:bg-[#232320] dark:hover:text-[#EDEDEB]';

export const TopBar: React.FC<TopBarProps> = ({
  session,
  totalQuestions,
  answeredCount,
  correctCount,
  stageIndex = 0,
  totalStages = 1,
  isDark,
  mobileSidebarOpen,
  onToggleTheme,
  onOpenSidebar,
  onOpenSettings,
}) => {
  return (
    <header className="sticky top-0 z-30 h-12 border-b border-[#E7E5DE] bg-[#FBFBFA]/90 backdrop-blur-md dark:border-[#242422] dark:bg-[#111110]/90">
      <div className="flex h-full items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="Open session sidebar"
            aria-expanded={mobileSidebarOpen}
            aria-controls="session-sidebar"
            className={`${iconButtonClass} md:hidden`}
          >
            <PanelLeft className="h-[18px] w-[18px]" />
          </button>

          {session ? (
            <>
              <span
                title={session.title}
                className="truncate text-[13px] font-medium text-[#292824] dark:text-[#EDEDEB]"
              >
                {session.title}
              </span>
              <span
                aria-label={`${answeredCount} of ${totalQuestions} answered, ${correctCount} correct`}
                className="font-mono-code shrink-0 text-[11px] text-[#85837C] dark:text-[#85857D]"
              >
                {answeredCount}/{totalQuestions}
                {totalStages > 1 && ` · Step ${stageIndex + 1}/${totalStages}`}
              </span>
            </>
          ) : (
            <span className="text-[13px] text-[#85837C] dark:text-[#85857D]">
              <span className="font-editorial text-lg text-[#292824] md:hidden dark:text-[#EDEDEB]">
                Socratic
              </span>
              <span className="hidden md:inline">New session</span>
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleTheme}
            className={iconButtonClass}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Harness Engine settings"
            title="Settings"
            className={iconButtonClass}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

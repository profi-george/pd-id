/*
  Единый набор иконок приложения.

  Зачем свой файл, а не пакет: ПД-ИД — живой инструмент на проде, тянуть ради
  два десятка глифов ещё одну зависимость (и её обновления) незачем. Геометрия
  повторяет Lucide: сетка 24, скруглённые концы, толщина обводки 1.75 —
  оптический вес совпадает с текстом Manrope рядом.

  Иконки заменяют текстовые глифы, которыми интерфейс пользовался раньше
  (⋯ ✓ ▾ ← → + ✎ ☑ ◐ ✋ ?). Глиф рисуется системным шрифтом, поэтому его
  размер, толщина и вертикальное положение отличались на каждой ОС — ряды
  действий в карточке задачи из-за этого «плясали» между Windows и macOS.

  Все иконки декоративные: aria-hidden, focusable=false. Смысл должен нести
  aria-label кнопки-обёртки, а не сама картинка.
*/

type IconProps = {
  className?: string;
  /** Размер в px. По умолчанию 16 — под текст 13–15px в плотных списках. */
  size?: number;
  strokeWidth?: number;
};

function Svg({
  className,
  size = 16,
  strokeWidth = 1.75,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconMenu(p: IconProps) {
  return <Svg {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Svg>;
}

export function IconPlus(p: IconProps) {
  return <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
}

export function IconCheck(p: IconProps) {
  return <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>;
}

export function IconX(p: IconProps) {
  return <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
}

export function IconMore(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconChevronDown(p: IconProps) {
  return <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
}

export function IconChevronRight(p: IconProps) {
  return <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>;
}

export function IconChevronLeft(p: IconProps) {
  return <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>;
}

export function IconArrowLeft(p: IconProps) {
  return <Svg {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></Svg>;
}

export function IconArrowRight(p: IconProps) {
  return <Svg {...p}><path d="M5 12h14M12 5l7 7-7 7" /></Svg>;
}

export function IconArrowUpRight(p: IconProps) {
  return <Svg {...p}><path d="M7 17 17 7M8 7h9v9" /></Svg>;
}

export function IconCalendar(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </Svg>
  );
}

export function IconCalendarArrow(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 10V7a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 7v11a2.5 2.5 0 0 0 2.5 2.5H12" />
      <path d="M4 10h16M8 2.5v4M16 2.5v4" />
      <path d="M16 18h6m-2.5-2.5L22 18l-2.5 2.5" />
    </Svg>
  );
}

export function IconClock(p: IconProps) {
  return <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.5l3.5 2" /></Svg>;
}

export function IconSun(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
    </Svg>
  );
}

export function IconMoon(p: IconProps) {
  return <Svg {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></Svg>;
}

export function IconHistory(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4v4.5h4.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Svg>
  );
}

export function IconListChecks(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m3 6 1.75 1.75L8 4.5" />
      <path d="m3 16 1.75 1.75L8 14.5" />
      <path d="M11.5 6.5H21M11.5 16.5H21" />
    </Svg>
  );
}

export function IconGrid(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.75" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.75" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.75" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.75" />
    </Svg>
  );
}

export function IconRows(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="6" rx="1.75" />
      <rect x="3" y="14" width="18" height="6" rx="1.75" />
    </Svg>
  );
}

export function IconFolder(p: IconProps) {
  return <Svg {...p}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2a2 2 0 0 1 1.5.7l1.1 1.3h7.2A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" /></Svg>;
}

export function IconInbox(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 13.5 5.4 5.9A2 2 0 0 1 7.3 4.5h9.4a2 2 0 0 1 1.9 1.4L21 13.5v4A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" />
      <path d="M3 13.5h4.5l1.2 2.2h6.6l1.2-2.2H21" />
    </Svg>
  );
}

export function IconSparkles(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M11 3.5 12.6 8 17 9.6 12.6 11.2 11 15.7 9.4 11.2 5 9.6 9.4 8Z" />
      <path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
    </Svg>
  );
}

export function IconPencil(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16.5 3.9a2.1 2.1 0 0 1 3 3L8.4 18h-3v-3Z" />
      <path d="m14.5 6 3 3" />
    </Svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 6.5h16M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
      <path d="M6.5 6.5 7.3 19a1.8 1.8 0 0 0 1.8 1.7h5.8a1.8 1.8 0 0 0 1.8-1.7l.8-12.5" />
    </Svg>
  );
}

export function IconUndo(p: IconProps) {
  return <Svg {...p}><path d="M3.5 8.5h11a5.5 5.5 0 1 1 0 11H8" /><path d="M7 4 3.5 8.5 7 13" /></Svg>;
}

export function IconSettings(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </Svg>
  );
}

export function IconLogout(p: IconProps) {
  return <Svg {...p}><path d="M14 20H6.5A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4H14" /><path d="M17 15.5 20.5 12 17 8.5M20 12H9.5" /></Svg>;
}

export function IconHelp(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.5 2.5 0 0 1 4.85.8c0 1.7-2.45 2.4-2.45 2.4" />
      <path d="M12 16.6h.01" />
    </Svg>
  );
}

export function IconHalfCircle(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconHand(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 11V4.8a1.4 1.4 0 0 1 2.8 0V11" />
      <path d="M11.8 10.5V3.9a1.4 1.4 0 0 1 2.8 0v6.6" />
      <path d="M14.6 11V6.2a1.4 1.4 0 0 1 2.8 0V14a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.5-2L3.4 15a1.4 1.4 0 0 1 2.2-1.7L9 16.4" />
    </Svg>
  );
}

export function IconDrag(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="6" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.15" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconBookOpen(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 6.5S10 4.5 4 4.5v13c6 0 8 2 8 2s2-2 8-2v-13c-6 0-8 2-8 2Z" />
      <path d="M12 6.5v15" />
    </Svg>
  );
}

export function IconMic(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" />
    </Svg>
  );
}

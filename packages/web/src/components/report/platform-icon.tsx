import { Icon } from "@/components/icons";

type Props = { id: string; active?: boolean; size?: number };

export function PlatformIcon({ id, active = false, size = 18 }: Props) {
  const color = active ? "currentColor" : "var(--fg-muted)";
  const s = { width: size, height: size, color };

  switch (id) {
    case "reddit":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx={8} cy={9} r={5.5} />
          <circle cx={6} cy={9} r={0.9} fill="currentColor" stroke="none" />
          <circle cx={10} cy={9} r={0.9} fill="currentColor" stroke="none" />
          <path d="M5.5 11.2c.7.6 1.6 1 2.5 1s1.8-.4 2.5-1" strokeLinecap="round" />
          <circle cx={13} cy={6} r={1.2} />
          <path d="M12 5.2 9.5 2.5" strokeLinecap="round" />
        </svg>
      );
    case "g2":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx={8} cy={8} r={6} />
          <path d="M5.8 6.2c.3-.7 1.1-1.2 2-1.2 1.1 0 2 .7 2 1.7 0 .8-.4 1.3-1.2 1.9-.9.6-1.6 1.1-1.6 1.9v.6h2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="currentColor">
          <rect x={1} y={1} width={14} height={14} rx={2} fill="none" stroke="currentColor" strokeWidth={1.4} />
          <rect x={3.5} y={6} width={1.6} height={6} />
          <circle cx={4.3} cy={4.3} r={0.9} />
          <path d="M6.8 6h1.5v.8c.3-.5.9-.9 1.7-.9 1.3 0 1.9.8 1.9 2.2V12h-1.6V8.5c0-.8-.3-1.2-.9-1.2s-1.1.4-1.1 1.3V12H6.8V6Z" />
        </svg>
      );
    case "producthunt":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx={8} cy={8} r={6} />
          <path d="M6.5 11.5V4.5h2.2c1.1 0 2 .8 2 1.9 0 1-.9 1.9-2 1.9H6.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "twitter":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="currentColor">
          <path d="M11.5 2h2L9.4 7l4.6 7h-3.7l-3-4.5L4 14H2l4.4-5.2L2 2h3.8l2.8 4.1L11.5 2Z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={1.5}>
          <rect x={1.5} y={3.5} width={13} height={9} rx={2} />
          <path d="M6.8 6 10 8l-3.2 2V6Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "appstore":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M11 4.6c-.6 0-1.5.4-2 .4-.6 0-1.4-.4-2.1-.4-1.2 0-2.3.9-2.3 2.7 0 1.1.3 2.3.9 3.4.6 1 1.1 1.7 1.7 1.7.5 0 .8-.3 1.6-.3.7 0 1 .3 1.6.3.6 0 1.2-.6 1.7-1.6.4-.7.5-1.4.5-1.4s-1.3-.4-1.3-1.9c0-1.2 1-1.8 1-1.8s-.5-1.1-1.3-1.1Z" />
          <path d="M9.5 4c.3-.4.5-1 .4-1.5-.5 0-1.1.3-1.4.7-.3.3-.5.9-.4 1.4.5 0 1-.3 1.4-.6Z" />
        </svg>
      );
    case "playstore":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={1.4}>
          <path d="M3.5 2.5v11l8.5-5.5-8.5-5.5Z" strokeLinejoin="round" />
        </svg>
      );
    case "hn":
    case "hackernews":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={1.4}>
          <rect x={2} y={2} width={12} height={12} rx={1.5} />
          <path d="M5 5.5l3 3.5 3-3.5M8 9v3" strokeLinecap="round" />
        </svg>
      );
    case "devto":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={1.4}>
          <rect x={1.5} y={3} width={13} height={10} rx={1.5} />
          <path d="M5 6v4M5 6h1.5M5 10h1.5M8 6v4l1.5-2L11 10V6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "medium":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={1.4}>
          <circle cx={4.5} cy={8} r={2.5} />
          <ellipse cx={9.5} cy={8} rx={1.5} ry={2.5} />
          <ellipse cx={13} cy={8} rx={0.6} ry={2.5} />
        </svg>
      );
    case "trustpilot":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="currentColor">
          <path d="M8 1.5l1.8 4.2 4.5.3-3.4 3 1.1 4.4L8 11l-4 2.4 1.1-4.4-3.4-3 4.5-.3L8 1.5Z" />
        </svg>
      );
    default:
      return <Icon name="spark" size={size <= 16 ? 14 : 16} />;
  }
}

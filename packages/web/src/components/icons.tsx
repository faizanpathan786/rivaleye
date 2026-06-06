import type { CSSProperties } from "react";

export type IconName =
  | "search" | "plus" | "arrow-right" | "arrow-up" | "arrow-down"
  | "chev-right" | "chev-down" | "chev-up"
  | "x" | "check" | "home" | "scan" | "compare" | "history"
  | "user" | "settings" | "moon" | "sun" | "filter" | "download"
  | "share" | "external" | "spark" | "reddit" | "quote" | "trend-up"
  | "alert" | "spinner" | "list" | "logo";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, className, style }: IconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    style,
  };
  switch (name) {
    case "search":     return <svg {...props}><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>;
    case "plus":       return <svg {...props}><path d="M8 3v10M3 8h10"/></svg>;
    case "arrow-right":return <svg {...props}><path d="M3 8h10m-4-4 4 4-4 4"/></svg>;
    case "arrow-up":   return <svg {...props}><path d="M8 13V3m-4 4 4-4 4 4"/></svg>;
    case "arrow-down": return <svg {...props}><path d="M8 3v10m-4-4 4 4 4-4"/></svg>;
    case "chev-right": return <svg {...props}><path d="m6 3 5 5-5 5"/></svg>;
    case "chev-down":  return <svg {...props}><path d="m3 6 5 5 5-5"/></svg>;
    case "chev-up":    return <svg {...props}><path d="m3 10 5-5 5 5"/></svg>;
    case "x":          return <svg {...props}><path d="m4 4 8 8M12 4l-8 8"/></svg>;
    case "check":      return <svg {...props}><path d="m3 8 3 3 7-7"/></svg>;
    case "home":       return <svg {...props}><path d="M2 7.5 8 2l6 5.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5Z"/><path d="M6 14V9.5h4V14"/></svg>;
    case "scan":       return <svg {...props}><path d="M3 6V4a1 1 0 0 1 1-1h2M3 10v2a1 1 0 0 0 1 1h2M13 6V4a1 1 0 0 0-1-1h-2M13 10v2a1 1 0 0 1-1 1h-2"/><path d="M3 8h10"/></svg>;
    case "compare":    return <svg {...props}><path d="M8 2v12M3 5l-1.5 3L3 11h2v-6H3ZM13 5l1.5 3L13 11h-2v-6h2Z"/></svg>;
    case "history":    return <svg {...props}><path d="M2 8a6 6 0 1 0 1.8-4.3M2 3v3h3"/><path d="M8 5v3l2 1"/></svg>;
    case "user":       return <svg {...props}><circle cx="8" cy="6" r="2.5"/><path d="M3 13.5c.8-2.2 2.7-3.5 5-3.5s4.2 1.3 5 3.5"/></svg>;
    case "settings":   return <svg {...props}><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M1 8h2M13 8h2M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/></svg>;
    case "moon":       return <svg {...props}><path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z"/></svg>;
    case "sun":        return <svg {...props}><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.3 3.3l1 1M11.7 11.7l1 1M3.3 12.7l1-1M11.7 4.3l1-1"/></svg>;
    case "filter":     return <svg {...props}><path d="M2 3h12l-4.5 5.5V13L6.5 11V8.5L2 3Z"/></svg>;
    case "download":   return <svg {...props}><path d="M8 2v8m-3-3 3 3 3-3M2.5 13h11"/></svg>;
    case "share":      return <svg {...props}><circle cx="12" cy="3.5" r="1.7"/><circle cx="4" cy="8" r="1.7"/><circle cx="12" cy="12.5" r="1.7"/><path d="m5.5 7 5-2.5M5.5 9l5 2.5"/></svg>;
    case "external":   return <svg {...props}><path d="M6 3H3v10h10v-3M9 3h4v4M9 7l4-4"/></svg>;
    case "spark":      return <svg {...props}><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.3 3.3l2 2M10.7 10.7l2 2M3.3 12.7l2-2M10.7 5.3l2-2"/></svg>;
    case "reddit":     return <svg {...props}><circle cx="8" cy="9" r="5.5"/><circle cx="6" cy="9" r="0.9" fill="currentColor" stroke="none"/><circle cx="10" cy="9" r="0.9" fill="currentColor" stroke="none"/><path d="M5.5 11.2c.7.6 1.6 1 2.5 1s1.8-.4 2.5-1"/><circle cx="13" cy="6" r="1.2"/><path d="M12 5.2 9.5 2.5"/></svg>;
    case "quote":      return <svg {...props}><path d="M3 11V8a3 3 0 0 1 3-3V3M9 11V8a3 3 0 0 1 3-3V3"/></svg>;
    case "trend-up":   return <svg {...props}><path d="M2 11.5 6 7l3 2 5-5M10 4h4v4"/></svg>;
    case "alert":      return <svg {...props}><path d="M8 2 1.5 13.5h13L8 2Z"/><path d="M8 6.5v3M8 11.5v.5"/></svg>;
    case "spinner":    return <svg {...props} style={{ ...style, animation: "radar-sweep 0.7s linear infinite" }}><path d="M8 1.5a6.5 6.5 0 1 1-6.5 6.5"/></svg>;
    case "list":       return <svg {...props}><path d="M5 4h9M5 8h9M5 12h9M2 4h.01M2 8h.01M2 12h.01"/></svg>;
    case "logo":       return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.35"/>
        <circle cx="12" cy="12" r="6"  stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.55"/>
        <circle cx="12" cy="12" r="2"  fill="currentColor"/>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M12 12L20 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="radar-sweep" style={{ transformOrigin: "12px 12px" }}/>
      </svg>
    );
    default: return null;
  }
}

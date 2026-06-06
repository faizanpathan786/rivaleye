import { useState } from "react";
import { CONFIG } from "@/global-config";

interface CompetitorAvatarProps {
  name: string;
  domain?: string | null;
  size?: number;
  borderRadius?: number;
  color?: string;
}

const KNOWN_DOMAINS: Record<string, string> = {
  jira: "atlassian.com",
  confluence: "atlassian.com",
  trello: "trello.com",
  notion: "notion.so",
  monday: "monday.com",
  "monday.com": "monday.com",
  airtable: "airtable.com",
  figma: "figma.com",
  miro: "miro.com",
  slack: "slack.com",
  teams: "microsoft.com",
  "microsoft teams": "microsoft.com",
  zoom: "zoom.us",
  asana: "asana.com",
  clickup: "clickup.com",
  linear: "linear.app",
  github: "github.com",
  gitlab: "gitlab.com",
  bitbucket: "bitbucket.org",
  hubspot: "hubspot.com",
  salesforce: "salesforce.com",
  zendesk: "zendesk.com",
  intercom: "intercom.com",
  freshdesk: "freshdesk.com",
  pipedrive: "pipedrive.com",
  webflow: "webflow.com",
  framer: "framer.com",
  vercel: "vercel.com",
  netlify: "netlify.com",
  stripe: "stripe.com",
  shopify: "shopify.com",
  wordpress: "wordpress.com",
  squarespace: "squarespace.com",
  wix: "wix.com",
  dropbox: "dropbox.com",
  loom: "loom.com",
  calendly: "calendly.com",
  typeform: "typeform.com",
  mixpanel: "mixpanel.com",
  amplitude: "amplitude.com",
  segment: "segment.com",
  twilio: "twilio.com",
  sendgrid: "sendgrid.com",
  mailchimp: "mailchimp.com",
};

// Sources tried in order — our API proxy (Logo.dev) → Brandfetch → Google favicon
const SOURCES = (d: string) => [
  `${CONFIG.serverUrl}/v1/logo/${encodeURIComponent(d)}`,
  `https://cdn.brandfetch.io/${d}/w/400/h/400`,
  `https://www.google.com/s2/favicons?domain=${d}&sz=128`,
];

function avatarColor(name: string): string {
  let s = 0;
  for (const c of name) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const hue = s % 360;
  return `hsl(${hue}, 55%, 38%)`;
}

function resolveDomain(name: string, domain?: string | null): string {
  // KNOWN_DOMAINS wins over any guessed domain (e.g. linear.com → linear.app).
  // If the user explicitly supplied a real URL the name won't be in this map.
  const key = name.toLowerCase().trim();
  if (KNOWN_DOMAINS[key]) return KNOWN_DOMAINS[key]!;
  if (domain) {
    return domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  }
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
}

export function CompetitorAvatar({ name, domain, size = 40, borderRadius = 8, color }: CompetitorAvatarProps) {
  const [srcIndex, setSrcIndex] = useState(0);
  const bg = color ?? avatarColor(name);
  const d = resolveDomain(name, domain);
  const sources = SOURCES(d);
  const src = sources[srcIndex];

  const letterFallback = (
    <div
      style={{
        width: size,
        height: size,
        borderRadius,
        background: bg,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontSize: Math.max(size * 0.45, 8),
        fontWeight: 700,
        fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
        flexShrink: 0,
      }}
    >
      {(name[0] ?? "?").toUpperCase()}
    </div>
  );

  if (!src) return letterFallback;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius,
        overflow: "hidden",
        flexShrink: 0,
        background: "#fff",
        display: "grid",
        placeItems: "center",
        border: "1px solid var(--border-soft)",
      }}
    >
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "contain", display: "block" }}
        onError={() => setSrcIndex((i) => i + 1)}
      />
    </div>
  );
}

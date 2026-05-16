import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "@/components/icons";

const MONO = '"Geist Mono", ui-monospace, monospace';

type Complaint = {
  id: string;
  title: string;
  tag: string;
  mentions: number;
  delta: string;
  severity: number;
  summary: string;
  threads: number;
  sample: string;
};

type Quote = {
  who: string;
  sub: string;
  when: string;
  score: number;
  sentiment: number;
  text: string;
};

type CommentItem = {
  who: string;
  score: number;
  when: string;
  text: string;
  op?: boolean;
};

type Thread = {
  title: string;
  sub: string;
  score: number;
  when: string;
  comments: number;
  body?: string;
  comments_list?: CommentItem[];
};

interface ThreadModalProps {
  complaint?: Complaint | null;
  quote?: Quote | null;
  onClose: () => void;
}

export function ThreadModal({ complaint, quote, onClose }: ThreadModalProps) {
  const threads = complaint ? generateThreads(complaint) : [];
  const [openIdx, setOpenIdx] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!complaint && !quote) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(2px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up"
        style={{
          background: "var(--surface)",
          borderRadius: 14,
          border: "1px solid var(--border-soft)",
          boxShadow: "var(--shadow-lg)",
          width: "100%",
          maxWidth: 920,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-soft)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--accent-soft)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Icon name={quote ? "quote" : "list"} size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="re-eyebrow" style={{ fontSize: 10 }}>
              {quote
                ? "VERBATIM QUOTE"
                : `${complaint!.threads} THREADS · ${complaint!.mentions} MENTIONS`}
            </div>
            <h3 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 600 }}>
              {quote ? `${quote.who} in ${quote.sub}` : complaint!.title}
            </h3>
          </div>
          <button className="re-btn re-btn-ghost re-btn-icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {complaint && (
            <>
              <div
                style={{
                  width: 280,
                  borderRight: "1px solid var(--border-soft)",
                  overflowY: "auto",
                  background: "var(--bg-sunken)",
                }}
              >
                {threads.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setOpenIdx(i)}
                    style={{
                      width: "100%",
                      border: 0,
                      background: openIdx === i ? "var(--surface)" : "transparent",
                      padding: "12px 14px",
                      textAlign: "left",
                      borderBottom: "1px solid var(--border-soft)",
                      cursor: "pointer",
                      display: "block",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        className="font-mono-feat text-fg-faint"
                        style={{ fontSize: 10 }}
                      >
                        {t.sub}
                      </span>
                      <span
                        className="font-mono-feat text-fg-faint"
                        style={{ fontSize: 10 }}
                      >
                        {t.score}↑
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "var(--fg)",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {t.title}
                    </div>
                    <div
                      className="font-mono-feat text-fg-faint"
                      style={{ fontSize: 10, marginTop: 6 }}
                    >
                      {t.comments} comments · {t.when}
                    </div>
                  </button>
                ))}
              </div>
              <ThreadView t={threads[openIdx]} />
            </>
          )}
          {quote && (
            <div style={{ padding: 28, overflowY: "auto", flex: 1 }}>
              <blockquote
                style={{
                  margin: 0,
                  padding: 20,
                  borderLeft: "3px solid var(--accent)",
                  background: "var(--surface-2)",
                  borderRadius: "0 8px 8px 0",
                  fontSize: 16,
                  lineHeight: 1.6,
                  fontStyle: "italic",
                }}
              >
                "{quote.text}"
              </blockquote>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 16,
                  fontSize: 12,
                  flexWrap: "wrap",
                }}
              >
                <QuoteMeta label="USER" value={quote.who} />
                <QuoteMeta label="SUB" value={quote.sub} />
                <QuoteMeta label="UPVOTES" value={String(quote.score)} tnum />
                <QuoteMeta
                  label="SENTIMENT"
                  value={quote.sentiment.toFixed(2)}
                  tnum
                  color="var(--neg)"
                />
                <QuoteMeta label="AGE" value={quote.when} />
              </div>

              <div style={{ marginTop: 28 }}>
                <div className="re-eyebrow">CONTEXT · PARENT THREAD</div>
                <ThreadView
                  inline
                  t={{
                    title:
                      "Anyone else feel like Linear's pricing has gotten out of hand?",
                    sub: quote.sub,
                    score: 412,
                    when: quote.when,
                    comments: 156,
                    body: "We've been on Linear since seat 4. Now we're at 28 and it's becoming a line-item finance asks about.",
                    comments_list: [
                      {
                        who: quote.who,
                        score: quote.score,
                        when: quote.when,
                        text: quote.text,
                        op: true,
                      },
                      {
                        who: "u/pm_throwaway",
                        score: 218,
                        when: "2d",
                        text: "Same boat. Plus tier just to get SSO felt like a tax.",
                      },
                      {
                        who: "u/contractor_v",
                        score: 154,
                        when: "3d",
                        text: "I bill by the hour. Linear charges by the head. The math falls apart fast.",
                      },
                      {
                        who: "u/eng_lead",
                        score: 98,
                        when: "3d",
                        text: "Don't disagree but the alternative is Jira and I'm not going back.",
                      },
                    ],
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuoteMeta({
  label,
  value,
  tnum,
  color,
}: {
  label: string;
  value: string;
  tnum?: boolean;
  color?: string;
}) {
  const valStyle: CSSProperties = {
    fontFamily: MONO,
    color: color ?? "var(--fg)",
    fontVariantNumeric: tnum ? "tabular-nums" : undefined,
  };
  return (
    <span>
      <span className="font-mono-feat text-fg-faint">{label}</span>
      <br />
      <span style={valStyle}>{value}</span>
    </span>
  );
}

function ThreadView({ t, inline }: { t?: Thread; inline?: boolean }) {
  if (!t) return null;
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: inline ? 0 : 24 }}>
      {!inline && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <Icon name="reddit" size={14} className="text-fg-faint" />
            <span
              className="font-mono-feat text-fg-faint"
              style={{ fontSize: 11 }}
            >
              {t.sub}
            </span>
            <span
              className="font-mono-feat text-fg-faint"
              style={{ fontSize: 11 }}
            >
              ·
            </span>
            <span
              className="font-mono-feat text-fg-faint"
              style={{ fontSize: 11 }}
            >
              {t.when}
            </span>
            <span style={{ marginLeft: "auto" }}>
              <button className="re-btn re-btn-ghost re-btn-sm">
                <Icon name="external" size={12} /> open
              </button>
            </span>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            {t.title}
          </h2>
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 10,
              color: "var(--fg-muted)",
              fontSize: 12,
            }}
          >
            <span
              className="font-mono-feat"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t.score}↑
            </span>
            <span>·</span>
            <span>{t.comments} comments</span>
          </div>
          {t.body && (
            <p
              style={{
                marginTop: 16,
                lineHeight: 1.6,
                color: "var(--fg-muted)",
              }}
            >
              {t.body}
            </p>
          )}
        </>
      )}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {(t.comments_list ?? []).map((c, i) => (
          <div
            key={i}
            style={{
              padding: 14,
              borderLeft: c.op
                ? "2px solid var(--accent)"
                : "2px solid var(--border-soft)",
              background: c.op ? "var(--accent-soft)" : "transparent",
              borderRadius: "0 8px 8px 0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span
                className="font-mono-feat"
                style={{ fontSize: 11, fontWeight: 500 }}
              >
                {c.who}
              </span>
              {c.op && (
                <span
                  className="re-chip re-chip-accent"
                  style={{ fontSize: 9, padding: "1px 6px" }}
                >
                  QUOTED
                </span>
              )}
              <span
                className="font-mono-feat text-fg-faint"
                style={{ fontSize: 11 }}
              >
                · {c.when}
              </span>
              <span
                className="font-mono-feat text-fg-faint"
                style={{
                  fontSize: 11,
                  marginLeft: "auto",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {c.score}↑
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function generateThreads(complaint: Complaint): Thread[] {
  return [
    {
      title: `Anyone else feel like Linear's ${complaint.tag.toLowerCase()} has gotten out of hand?`,
      sub: "r/SaaS",
      score: 412,
      when: "3d",
      comments: 156,
      body: "We've been on Linear since seat 4. Now we're at 28 and it's becoming a line-item finance asks about.",
      comments_list: [
        {
          who: "u/founder_42",
          score: 187,
          when: "3d",
          text: complaint.sample,
          op: true,
        },
        {
          who: "u/pm_throwaway",
          score: 142,
          when: "2d",
          text: "Same. Bringing in 6 contractors for Q4 means $1k/mo for partial usage.",
        },
        {
          who: "u/eng_lead",
          score: 98,
          when: "3d",
          text: "Hot take: Linear is worth it. But I do wish there was a 'viewer' price point.",
        },
        {
          who: "u/skeptic_pm",
          score: 71,
          when: "2d",
          text: "Try ClickUp if you're price-sensitive. We left two years ago and don't miss it.",
        },
      ],
    },
    {
      title: `Linear ${complaint.tag.toLowerCase()} — workarounds?`,
      sub: "r/ExperiencedDevs",
      score: 287,
      when: "5d",
      comments: 89,
      body: "Looking for what people are actually doing about this. Not interested in 'switch tools' answers.",
      comments_list: [
        {
          who: "u/staff_eng",
          score: 142,
          when: "5d",
          text: "We piped Linear → Toggl via webhook. Hacky but works for billing.",
        },
        {
          who: "u/devops_dan",
          score: 98,
          when: "4d",
          text: "Honestly we just rolled our own. Linear API is good enough.",
        },
      ],
    },
    {
      title: `Quitting Linear after 18 months — here's why`,
      sub: "r/startups",
      score: 198,
      when: "1w",
      comments: 132,
      body: "Long one. tl;dr: it's good software, bad math for our team.",
      comments_list: [
        {
          who: "u/startup_charlie",
          score: 84,
          when: "1w",
          text: "Bought Linear for the speed. Stayed for the speed. Annoyed by the price every time we grow.",
          op: true,
        },
        {
          who: "u/founder_h",
          score: 56,
          when: "6d",
          text: "Where are you going? Jira feels like going backwards.",
        },
      ],
    },
  ];
}

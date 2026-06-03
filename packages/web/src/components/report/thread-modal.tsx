import { useEffect } from "react";
import { Icon } from "@/components/icons";
import { useReportThreadQuery } from "@/hooks/queries/use-reports";
import { formatRelative } from "@/lib/format";

interface ThreadModalProps {
  reportId: string;
  threadId: string | null;
  onClose: () => void;
}

export function ThreadModal({ reportId, threadId, onClose }: ThreadModalProps) {
  const { data, isLoading, isError, error, refetch } = useReportThreadQuery(
    reportId,
    threadId ?? undefined,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!threadId) return null;

  return (
    <div
      onClick={onClose}
      className="p-3 md:p-10"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(2px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up w-[92vw] sm:w-full"
        style={{
          background: "var(--surface)",
          borderRadius: 14,
          border: "1px solid var(--border-soft)",
          boxShadow: "var(--shadow-lg)",
          maxWidth: 920,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          className="px-4 py-3 md:px-5 md:py-4"
          style={{
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
            <Icon name="list" size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="re-eyebrow" style={{ fontSize: 10 }}>
              {data
                ? `${data.comments?.length ?? 0} COMMENTS · ${data.score}↑`
                : isLoading
                  ? "LOADING…"
                  : "THREAD"}
            </div>
            <h3
              style={{
                margin: "2px 0 0",
                fontSize: 16,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {data?.title ?? (isLoading ? "Loading thread…" : "Thread")}
            </h3>
          </div>
          {data?.url && (
            <a
              href={data.url}
              target="_blank"
              rel="noreferrer"
              className="re-btn re-btn-ghost re-btn-sm"
            >
              <Icon name="external" size={12} /> open
            </a>
          )}
          <button className="re-btn re-btn-ghost re-btn-icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        <div
          className="p-4 md:p-6"
          style={{
            display: "flex",
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          {isLoading && (
            <div style={{ width: "100%" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 64,
                    marginBottom: 12,
                    borderRadius: 8,
                    background: "var(--surface-2)",
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          )}

          {isError && (
            <div
              style={{
                color: "var(--neg)",
                fontSize: 13,
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span>
                {(error as Error)?.message ?? "Failed to load thread."}
              </span>
              <button
                className="re-btn re-btn-ghost re-btn-sm"
                onClick={() => refetch()}
              >
                Retry
              </button>
            </div>
          )}

          {data && (
            <div style={{ width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  marginBottom: 16,
                  color: "var(--fg-muted)",
                  fontSize: 12,
                }}
                className="font-mono-feat"
              >
                {data.source && <span>{data.source}</span>}
                {data.posted_at && (
                  <span>· {formatRelative(data.posted_at)}</span>
                )}
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  · {data.score}↑
                </span>
              </div>

              {data.body && (
                <p
                  className="break-words"
                  style={{
                    marginTop: 0,
                    marginBottom: 20,
                    lineHeight: 1.6,
                    color: "var(--fg-muted)",
                    fontSize: 14,
                  }}
                >
                  {data.body}
                </p>
              )}

              {(!data.comments || data.comments.length === 0) && (
                <div
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "var(--fg-faint)",
                    fontSize: 13,
                    border: "1px dashed var(--border-soft)",
                    borderRadius: 8,
                  }}
                >
                  No comments on this thread.
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {(data.comments ?? []).map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: 14,
                      borderLeft: "2px solid var(--border-soft)",
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
                        className="font-mono-feat truncate"
                        style={{ fontSize: 11, fontWeight: 500, minWidth: 0 }}
                      >
                        {c.author}
                      </span>
                      <span
                        className="font-mono-feat text-fg-faint"
                        style={{ fontSize: 11 }}
                      >
                        · {formatRelative(c.posted_at)}
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
                    <p
                      className="break-words"
                      style={{
                        margin: 0,
                        fontSize: 13,
                        lineHeight: 1.55,
                      }}
                    >
                      {c.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

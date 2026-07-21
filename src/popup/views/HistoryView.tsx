import { useEffect } from "react";
import type { CheckHistoryItem, HistorySortOption } from "../../shared/types";
import { useApp } from "../context/AppContext";

function scoreForSort(item: CheckHistoryItem, sort: HistorySortOption): number {
  if (sort === "date") {
    return new Date(item.report.checkedAt).getTime();
  }

  if (sort === "overall") {
    return item.report.overallScore;
  }

  const category = item.report.categoryScores.find(
    (entry) => entry.label.toLowerCase() === sort
  );
  return category?.score ?? item.report.overallScore;
}

export function HistoryView() {
  const {
    checkHistory,
    refreshHistory,
    openHistoryItem,
    deleteHistoryItem,
    historySort,
    setHistorySort,
  } = useApp();

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const sorted = [...checkHistory].sort(
    (a, b) => scoreForSort(b, historySort) - scoreForSort(a, historySort)
  );

  if (!sorted.length) {
    return (
      <p style={{ color: "var(--color-muted)", fontSize: 12 }}>
        No compatibility checks yet. Run a check from Home.
      </p>
    );
  }

  async function handleDelete(key: string, title: string) {
    const confirmed = window.confirm(
      `Delete this compatibility report for "${title || "Untitled job"}"?`
    );
    if (!confirmed) return;
    await deleteHistoryItem(key);
  }

  return (
    <section className="history-list">
      <div className="history-sort-row">
        <label htmlFor="history-sort">Sort by</label>
        <select
          id="history-sort"
          value={historySort}
          onChange={(e) =>
            void setHistorySort(e.target.value as HistorySortOption)
          }
        >
          <option value="overall">Overall score</option>
          <option value="skills">Skills</option>
          <option value="experience">Experience</option>
          <option value="preferences">Preferences</option>
          <option value="date">Date checked</option>
        </select>
      </div>

      {sorted.map((item) => (
        <article
          key={item.key}
          className="history-item"
          onClick={() => openHistoryItem(item)}
        >
          <div className="history-item-header">
            <h3>
              {item.title || "Untitled job"} — {item.report.overallScore}/100
            </h3>
            <button
              type="button"
              className="secondary-btn history-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(item.key, item.title);
              }}
            >
              Delete
            </button>
          </div>
          <div className="history-meta">
            {item.company && `${item.company} · `}
            {item.salary && `${item.salary} · `}
            {item.location}
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Open original listing
          </a>
        </article>
      ))}
    </section>
  );
}

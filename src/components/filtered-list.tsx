import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

export type CardFilter<T> = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  match: (row: T, value: string) => boolean;
};

export type FilteredListProps<T> = {
  rows: T[];
  rowKey: (row: T) => string;
  render: (row: T) => ReactNode;
  searchable?: (row: T) => string;
  filters?: CardFilter<T>[];
  dateField?: (row: T) => string | Date | null | undefined;
  pageSize?: number;
  emptyMessage?: ReactNode;
  toolbarClassName?: string;
  listClassName?: string;
};

/** Toolbar + pagination wrapper for card-based lists that aren't tables. */
export function FilteredList<T>({
  rows,
  rowKey,
  render,
  searchable,
  filters = [],
  dateField,
  pageSize: initialPageSize = 12,
  emptyMessage = "No records.",
  toolbarClassName = "",
  listClassName = "space-y-4",
}: FilteredListProps<T>) {
  const [q, setQ] = useState("");
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 86_399_000 : null;
    return rows.filter((row) => {
      if (query && searchable && !searchable(row).toLowerCase().includes(query)) return false;
      for (const f of filters) {
        const v = filterState[f.key];
        if (v && !f.match(row, v)) return false;
      }
      if (dateField && (from != null || to != null)) {
        const raw = dateField(row);
        if (!raw) return false;
        const t = new Date(raw).getTime();
        if (from != null && t < from) return false;
        if (to != null && t > to) return false;
      }
      return true;
    });
  }, [rows, q, filters, filterState, dateField, dateFrom, dateTo, searchable]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const hasFiltersActive = q || dateFrom || dateTo || Object.values(filterState).some(Boolean);

  return (
    <div>
      {(searchable || filters.length > 0 || dateField) && (
        <div className={`mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-glass-border bg-card/40 p-3 ${toolbarClassName}`}>
          {searchable && (
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder="Search…"
                className="w-full rounded border border-glass-border bg-background pl-8 pr-2 py-2 text-sm"
              />
            </div>
          )}
          {filters.map((f) => (
            <select
              key={f.key}
              value={filterState[f.key] ?? ""}
              onChange={(e) => { setFilterState({ ...filterState, [f.key]: e.target.value }); setPage(1); }}
              className="rounded border border-glass-border bg-background px-2 py-2 text-sm"
            >
              <option value="">{f.label}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
          {dateField && (
            <>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="rounded border border-glass-border bg-background px-2 py-2 text-xs" title="From" />
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="rounded border border-glass-border bg-background px-2 py-2 text-xs" title="To" />
            </>
          )}
          {hasFiltersActive && (
            <button
              onClick={() => { setQ(""); setFilterState({}); setDateFrom(""); setDateTo(""); setPage(1); }}
              className="inline-flex items-center gap-1 rounded border border-glass-border px-2 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
        </div>
      )}

      {pageRows.length === 0 ? (
        <div className="glass rounded-2xl border border-glass-border p-8 text-center text-muted-foreground">{emptyMessage}</div>
      ) : (
        <div className={listClassName}>
          {pageRows.map((row) => <div key={rowKey(row)}>{render(row)}</div>)}
        </div>
      )}

      {filtered.length > 6 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Cards per page</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded border border-glass-border bg-background px-2 py-1">
              {[6, 12, 24, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>{filtered.length === 0 ? 0 : start + 1}–{Math.min(start + pageSize, filtered.length)} of {filtered.length}</span>
            <button disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex items-center gap-1 rounded border border-glass-border px-2 py-1 disabled:opacity-40">
              <ChevronLeft className="h-3 w-3" /> Prev
            </button>
            <span>Page {currentPage} / {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="inline-flex items-center gap-1 rounded border border-glass-border px-2 py-1 disabled:opacity-40">
              Next <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

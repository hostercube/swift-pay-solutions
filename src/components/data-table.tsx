import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, X, Download, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export type DataTableColumn<T> = {
  key: string;
  label: ReactNode;
  render?: (row: T) => ReactNode;
  className?: string;
  thClassName?: string;
  /** Enable sorting on this column. */
  sortable?: boolean;
  /** Provide comparable value for sorting/export. Defaults to row[key]. */
  accessor?: (row: T) => string | number | Date | null | undefined;
};

export type DataTableFilter<T> = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  match: (row: T, value: string) => boolean;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchable?: (row: T) => string;
  filters?: DataTableFilter<T>[];
  dateField?: (row: T) => string | Date | null | undefined;
  pageSize?: number;
  pageSizeOptions?: number[];
  loading?: boolean;
  emptyMessage?: ReactNode;
  toolbar?: ReactNode;
  actions?: (row: T) => ReactNode;
  className?: string;
  /** Enable CSV export button. Filename base (no extension). */
  exportFilename?: string;
};

function getAccessor<T>(col: DataTableColumn<T>, row: T): unknown {
  if (col.accessor) return col.accessor(row);
  return (row as unknown as Record<string, unknown>)[col.key];
}

function toCsvValue(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchable,
  filters = [],
  dateField,
  pageSize: initialPageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  loading = false,
  emptyMessage = "No records found.",
  toolbar,
  actions,
  className = "",
  exportFilename,
}: DataTableProps<T>) {
  const [q, setQ] = useState("");
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

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

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = getAccessor(col, a);
      const bv = getAccessor(col, b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      const at = av instanceof Date ? av.getTime() : String(av).toLowerCase();
      const bt = bv instanceof Date ? bv.getTime() : String(bv).toLowerCase();
      if (at < bt) return -1 * dir;
      if (at > bt) return 1 * dir;
      return 0;
    });
  }, [filtered, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const hasFiltersActive =
    q || dateFrom || dateTo || Object.values(filterState).some(Boolean);

  const resetAll = () => {
    setQ("");
    setFilterState({});
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const toggleSort = (key: string) => {
    setPage(1);
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const exportCsv = () => {
    const header = columns.map((c) => (typeof c.label === "string" ? c.label : c.key));
    const lines = [header.map(toCsvValue).join(",")];
    for (const row of sorted) {
      lines.push(columns.map((c) => toCsvValue(getAccessor(c, row))).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename ?? "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const colCount = columns.length + (actions ? 1 : 0);

  return (
    <div className={`glass rounded-2xl border border-glass-border ${className}`}>
      {(searchable || filters.length > 0 || dateField || toolbar || exportFilename) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-glass-border p-3">
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
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="rounded border border-glass-border bg-background px-2 py-2 text-xs" title="From" />
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="rounded border border-glass-border bg-background px-2 py-2 text-xs" title="To" />
            </>
          )}
          {hasFiltersActive && (
            <button onClick={resetAll}
              className="inline-flex items-center gap-1 rounded border border-glass-border px-2 py-2 text-xs text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>{sorted.length} result{sorted.length === 1 ? "" : "s"}</span>
            {exportFilename && sorted.length > 0 && (
              <button onClick={exportCsv}
                className="inline-flex items-center gap-1 rounded border border-glass-border px-2 py-1 hover:text-foreground"
                title="Export current view as CSV">
                <Download className="h-3 w-3" /> CSV
              </button>
            )}
          </div>
          {toolbar}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} className={`px-4 py-3 ${c.thClassName ?? ""}`}>
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {c.label}
                        {active ? (
                          sort!.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : c.label}
                  </th>
                );
              })}
              {actions && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colCount} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={colCount} className="px-4 py-8 text-center text-muted-foreground">{emptyMessage}</td></tr>
            ) : (
              pageRows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-glass-border align-top">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.className ?? ""}`}>
                      {c.render ? c.render(row) : (row as unknown as Record<string, ReactNode>)[c.key] ?? "—"}
                    </td>
                  ))}
                  {actions && <td className="px-4 py-3 text-right">{actions(row)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > pageSizeOptions[0] && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-glass-border p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="rounded border border-glass-border bg-background px-2 py-1">
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>{sorted.length === 0 ? 0 : start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}</span>
            <button disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded border border-glass-border px-2 py-1 disabled:opacity-40">
              <ChevronLeft className="h-3 w-3" /> Prev
            </button>
            <span>Page {currentPage} / {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded border border-glass-border px-2 py-1 disabled:opacity-40">
              Next <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

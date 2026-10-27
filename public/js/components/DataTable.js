/**
 * DataTable Component
 * High-performance, responsive React DataTable with multi-column live search,
 * sorting, pagination, entries per page selector, and CSV export.
 */

const { useState, useMemo } = React;

function DataTable({
  columns = [],
  data = [],
  searchPlaceholder = '🔍 Search in all columns...',
  searchKeys = null,
  initialPageSize = 20,
  defaultSortKey = null,
  defaultSortDir = 'asc',
  actions = null,
  customFilter = null,
  emptyMessage = 'No matching records found',
  exportFilename = 'export_data.csv'
}) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState(defaultSortKey || (columns[0]?.key || null));
  const [sortDir, setSortDir] = useState(defaultSortDir);

  // 1. Search Filtering
  const filteredData = useMemo(() => {
    if (!search || !search.trim()) return data;
    const q = search.toLowerCase().trim();

    return data.filter(row => {
      const keysToScan = searchKeys || columns.map(c => c.key);
      return keysToScan.some(k => {
        const val = row[k];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [data, search, searchKeys, columns]);

  // 2. Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      // Handle nulls
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      // Number comparison
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }

      // Numeric string comparison (e.g. salary, amounts)
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '' && typeof valA !== 'boolean') {
        return sortDir === 'asc' ? numA - numB : numB - numA;
      }

      // Date comparison
      const dateA = Date.parse(valA);
      const dateB = Date.parse(valB);
      if (!isNaN(dateA) && !isNaN(dateB) && isNaN(valA) && isNaN(valB) && String(valA).includes('-')) {
        return sortDir === 'asc' ? dateA - dateB : dateB - dateA;
      }

      // String comparison
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDir === 'asc' ? -1 : 1;
      if (strA > strB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortKey, sortDir]);

  // 3. Pagination
  const totalEntries = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const activePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, activePage, pageSize]);

  // Handlers
  const handleSort = (key, sortable = true) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleExportCSV = () => {
    if (!data.length) return;
    const exportCols = columns.filter(c => c.key && c.label && c.key !== 'actions');
    const headerRow = exportCols.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
    const rows = sortedData.map(row => {
      return exportCols.map(c => {
        let val = row[c.key];
        if (val === null || val === undefined) val = '';
        if (typeof window.formatAppDate === 'function' && (c.key.includes('date') || c.key.includes('_at')) && val) {
          val = window.formatAppDate(val);
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headerRow, ...rows].join('\r\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', exportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, activePage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  };

  const startEntry = totalEntries === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const endEntry = Math.min(activePage * pageSize, totalEntries);

  return (
    <div className="datatable-container">
      {/* DataTable Top Control Bar */}
      <div className="datatable-topbar">
        <div className="datatable-top-left">
          <label className="datatable-length-label">
            Show
            <select
              className="datatable-length-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            entries
          </label>

          {customFilter && <div className="datatable-custom-filter">{customFilter}</div>}
        </div>

        <div className="datatable-top-right">
          <div className="datatable-search-wrapper">
            <input
              type="text"
              className="datatable-search-input"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
            {search && (
              <button
                className="datatable-search-clear"
                title="Clear search"
                onClick={() => { setSearch(''); setCurrentPage(1); }}
              >
                ✕
              </button>
            )}
          </div>

          <button
            className="btn btn-outline btn-sm"
            onClick={handleExportCSV}
            title="Export filtered records to CSV"
          >
            📥 Export CSV
          </button>

          {actions && <div className="datatable-actions">{actions}</div>}
        </div>
      </div>

      {/* Responsive Table Wrapper */}
      <div className="table-responsive">
        <table className="data-table datatable-table">
          <thead>
            <tr>
              {columns.map((col, idx) => {
                const isSorted = sortKey === col.key;
                const isSortable = col.sortable !== false;
                return (
                  <th
                    key={col.key || idx}
                    className={`datatable-th ${isSortable ? 'sortable' : ''} ${isSorted ? 'sorted' : ''}`}
                    style={{ ...col.headerStyle, width: col.width }}
                    onClick={() => handleSort(col.key, isSortable)}
                    title={isSortable ? `Sort by ${col.label}` : ''}
                  >
                    <div className="th-content">
                      <span>{col.label}</span>
                      {isSortable && (
                        <span className="sort-icon">
                          {isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIdx) => (
              <tr key={row.id || rowIdx} className="datatable-row">
                {columns.map((col, colIdx) => (
                  <td key={col.key || colIdx} style={col.style} className={col.className}>
                    {col.render ? col.render(row[col.key], row, rowIdx) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}

            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{emptyMessage}</strong>
                  {search && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => { setSearch(''); setCurrentPage(1); }}
                      >
                        Reset Search Filter
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DataTable Bottom Info & Pagination Bar */}
      <div className="datatable-bottombar">
        <div className="datatable-info">
          Showing <strong>{startEntry}</strong> to <strong>{endEntry}</strong> of <strong>{totalEntries}</strong> entries
          {search && data.length !== totalEntries && (
            <span style={{ color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
              (filtered from {data.length} total entries)
            </span>
          )}
        </div>

        <div className="datatable-pagination">
          <button
            className="btn btn-outline btn-sm page-btn"
            disabled={activePage <= 1}
            onClick={() => handlePageChange(activePage - 1)}
          >
            Previous
          </button>

          {getPageNumbers().map(p => (
            <button
              key={p}
              className={`btn btn-sm page-btn ${activePage === p ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handlePageChange(p)}
            >
              {p}
            </button>
          ))}

          <button
            className="btn btn-outline btn-sm page-btn"
            disabled={activePage >= totalPages}
            onClick={() => handlePageChange(activePage + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

window.DataTable = DataTable;

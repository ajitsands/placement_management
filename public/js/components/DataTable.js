/**
 * DataTable Component
 * High-performance, responsive React DataTable with multi-column live search,
 * sorting, pagination, entries per page selector, and CSV export.
 */

const { useState, useMemo, useEffect, useRef } = React;

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
  exportFilename = 'export_data.csv',
  expandable = false,
  renderChildRow = null,
  defaultExpandedAll = false
}) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState(defaultSortKey || (columns[0]?.key || null));
  const [sortDir, setSortDir] = useState(defaultSortDir);
  const [expandedRowIds, setExpandedRowIds] = useState(() => {
    if (defaultExpandedAll && Array.isArray(data)) {
      return new Set(data.map((r, i) => (r.id !== undefined && r.id !== null ? r.id : i)));
    }
    return new Set();
  });

  const toggleRowExpand = (id) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllExpand = () => {
    if (expandedRowIds.size > 0) {
      setExpandedRowIds(new Set());
    } else {
      const allIds = new Set(paginatedData.map((r, i) => (r.id !== undefined && r.id !== null ? r.id : i)));
      setExpandedRowIds(allIds);
    }
  };

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

    const csvContent = '\uFEFF' + [headerRow, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', exportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 500);
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
              {expandable && (
                <th
                  style={{ width: '42px', minWidth: '42px', textAlign: 'center', padding: '0.65rem 0.35rem', cursor: 'pointer' }}
                  onClick={toggleAllExpand}
                  title={expandedRowIds.size > 0 ? "Collapse all child rows" : "Expand all child rows"}
                >
                  <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 800 }}>
                    {expandedRowIds.size > 0 && paginatedData.length > 0 ? '▼' : '▶'}
                  </span>
                </th>
              )}
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
            {paginatedData.map((row, rowIdx) => {
              const rowId = row.id !== undefined && row.id !== null ? row.id : rowIdx;
              const isExpanded = expandedRowIds.has(rowId);
              return (
                <React.Fragment key={rowId}>
                  <tr className={`datatable-row ${isExpanded ? 'expanded' : ''}`}>
                    {expandable && (
                      <td style={{ width: '42px', minWidth: '42px', textAlign: 'center', padding: '0.65rem 0.35rem', verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => toggleRowExpand(rowId)}
                          style={{
                            border: '1px solid var(--border-light)',
                            background: isExpanded ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                            color: isExpanded ? 'var(--primary)' : 'var(--text-secondary)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.4rem',
                            lineHeight: 1
                          }}
                          title={isExpanded ? 'Collapse row details' : 'Expand row details'}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                    )}
                    {columns.map((col, colIdx) => (
                      <td key={col.key || colIdx} style={col.style} className={col.className}>
                        {col.render ? col.render(row[col.key], row, rowIdx, { isExpanded, toggleExpand: () => toggleRowExpand(rowId) }) : (row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                  {expandable && isExpanded && renderChildRow && (
                    <tr className="datatable-child-row" style={{ background: 'var(--bg-tertiary, #f8fafc)' }}>
                      <td colSpan={columns.length + (expandable ? 1 : 0)} style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--border-light)' }}>
                        {renderChildRow(row, { isExpanded, toggleExpand: () => toggleRowExpand(rowId) })}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={columns.length + (expandable ? 1 : 0)} style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
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

/**
 * SearchableSelect Component
 * Accessible, keyboard-navigable searchable combobox dropdown.
 */
function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Type to search...',
  icon = null,
  style = {},
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase().trim();
    return options.filter(opt => {
      const matchLabel = opt.label && String(opt.label).toLowerCase().includes(q);
      const matchSub = opt.subLabel && String(opt.subLabel).toLowerCase().includes(q);
      const matchKeywords = opt.searchKeywords && String(opt.searchKeywords).toLowerCase().includes(q);
      return matchLabel || matchSub || matchKeywords;
    });
  }, [options, searchTerm]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find(opt => String(opt.value) === String(value)) || null;
  }, [options, value]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Reset highlight and focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setHighlightedIndex(0);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 30);
    }
  }, [isOpen]);

  // Ensure highlighted index stays in bounds
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  const handleSelect = (optVal) => {
    if (onChange) onChange(optVal);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) onChange('');
  };

  const scrollOptionIntoView = (index) => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
        scrollOptionIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
        scrollOptionIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        width: '100%',
        ...style
      }}
    >
      {/* Trigger Box */}
      <div
        className="input-control"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '0.35rem 0.65rem',
          fontSize: '0.82rem',
          userSelect: 'none',
          minHeight: '34px',
          borderColor: isOpen ? 'var(--primary)' : 'var(--border-light)',
          boxShadow: isOpen ? '0 0 0 3px var(--primary-glow)' : 'none',
          background: 'var(--bg-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {icon && <span style={{ fontSize: '0.9rem' }}>{icon}</span>}
          <span style={{
            color: selectedOption && selectedOption.value !== '' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: selectedOption && selectedOption.value !== '' ? 600 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.45rem' }}>
          {value !== '' && (
            <span
              onClick={handleClear}
              title="Clear selection"
              style={{
                color: 'var(--danger)',
                fontSize: '0.85rem',
                padding: '0 0.2rem',
                cursor: 'pointer',
                fontWeight: 700,
                lineHeight: 1
              }}
            >
              ✕
            </span>
          )}
          <span style={{
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease'
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: '0.45rem',
            animation: 'fadeIn 0.12s ease-out',
            minWidth: '260px'
          }}
        >
          {/* Live Search Input Box */}
          <div style={{ position: 'relative', marginBottom: '0.45rem' }}>
            <span style={{
              position: 'absolute',
              left: '0.65rem',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)'
            }}>
              🔍
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="input-control"
              style={{
                padding: '0.35rem 1.6rem 0.35rem 1.85rem',
                fontSize: '0.8rem',
                width: '100%',
                background: 'var(--bg-tertiary)'
              }}
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            {searchTerm && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                ✕
              </span>
            )}
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            {filteredOptions.length === 0 ? (
              <div style={{
                padding: '0.85rem 0.5rem',
                textAlign: 'center',
                fontSize: '0.8rem',
                color: 'var(--text-muted)'
              }}>
                No options match "<strong>{searchTerm}</strong>"
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={opt.value || idx}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected
                        ? 'var(--primary-subtle, rgba(37, 99, 235, 0.12))'
                        : (isHighlighted ? 'var(--bg-tertiary)' : 'transparent'),
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 700 : 500,
                      transition: 'background 0.1s ease'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {opt.label}
                      </span>
                      {opt.subLabel && (
                        <span style={{
                          fontSize: '0.72rem',
                          color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                          fontWeight: 400
                        }}>
                          {opt.subLabel}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, marginLeft: '0.5rem' }}>✓</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

window.SearchableSelect = SearchableSelect;

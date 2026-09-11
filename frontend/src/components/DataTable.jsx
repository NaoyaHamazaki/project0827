import './DataTable.css'

export default function DataTable({
  columns,
  rows,
  rowKey,
  emptyMessage = 'データがありません',
  mobileCompact = false,
  rowClassName,
}) {
  if (rows.length === 0) {
    return <div className="data-table__empty">{emptyMessage}</div>
  }

  return (
    <div className={`data-table__wrapper ${mobileCompact ? 'data-table__wrapper--mobile-compact' : ''}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={column.width ? { width: column.width } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={rowClassName ? rowClassName(row) : undefined}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.header}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

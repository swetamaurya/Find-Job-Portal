export default function DataTable({ columns, data, onRowSelect, selectedRows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {onRowSelect && (
              <th className="py-3 px-4 text-left">
                <input
                  type="checkbox"
                  checked={selectedRows?.size === data.length && data.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onRowSelect(new Set(data.map((_, i) => i)));
                    } else {
                      onRowSelect(new Set());
                    }
                  }}
                />
              </th>
            )}
            {columns.map((col) => (
              <th key={col.key} className="py-3 px-4 text-left text-gray-600 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length + (onRowSelect ? 1 : 0)} className="py-8 text-center text-gray-400">
                No data
              </td>
            </tr>
          )}
          {data.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
              {onRowSelect && (
                <td className="py-3 px-4">
                  <input
                    type="checkbox"
                    checked={selectedRows?.has(i) || false}
                    onChange={() => {
                      const next = new Set(selectedRows);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      onRowSelect(next);
                    }}
                  />
                </td>
              )}
              {columns.map((col) => (
                <td key={col.key} className="py-3 px-4 text-gray-700">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

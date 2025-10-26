"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface Column<T> {
  key: string
  header: string
  render: (item: T, index: number) => ReactNode
  className?: string
  headerClassName?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  className?: string
  headerClassName?: string
  rowClassName?: string | ((item: T, index: number) => string)
  emptyMessage?: string
  loading?: boolean
}

export function DataTable<T>({
  data,
  columns,
  className,
  headerClassName,
  rowClassName,
  emptyMessage = "No hay datos disponibles",
  loading = false
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <span className="ml-2 text-muted-foreground">Cargando...</span>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full min-w-0", className)}>
        <thead>
          <tr className={cn("border-b bg-gray-50", headerClassName)}>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "text-left py-3 px-2 text-sm font-medium text-gray-700",
                  column.headerClassName
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const rowClass = typeof rowClassName === 'function' 
              ? rowClassName(item, index) 
              : rowClassName

            return (
              <tr
                key={index}
                className={cn("border-b hover:bg-gray-50", rowClass)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn("py-3 px-2", column.className)}
                  >
                    {column.render(item, index)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

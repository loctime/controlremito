import { TableRowSkeleton } from '@/components/ui/skeleton-cards'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">
                <Skeleton className="h-4 w-20" />
              </th>
              <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">
                <Skeleton className="h-4 w-20" />
              </th>
              <th className="text-center py-3 px-2 text-sm font-medium text-gray-700">
                <Skeleton className="h-4 w-16" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

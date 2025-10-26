import { Skeleton } from '@/components/ui/skeleton'

export function OrderCardSkeleton() {
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

export function TemplateCardSkeleton() {
  return (
    <div className="border rounded-lg p-6 space-y-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <tr className="border-b">
      <td className="py-3 px-2">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="py-3 px-2">
        <Skeleton className="h-4 w-32" />
      </td>
      <td className="py-3 px-2">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="py-3 px-2">
        <Skeleton className="h-6 w-16 rounded-full" />
      </td>
      <td className="py-3 px-2">
        <Skeleton className="h-8 w-20" />
      </td>
    </tr>
  )
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { fetchOrdersList } from '@/lib/orders.service'
import { useAuth } from '@/lib/auth-context'

export const useOrdersList = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['orders-list', user?.id, user?.role, user?.branchId],
    queryFn: () => fetchOrdersList(user ?? null),
    enabled: !!user,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}


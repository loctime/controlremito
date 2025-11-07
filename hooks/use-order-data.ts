import { useState, useCallback, useMemo } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Branch, Product, Order } from "@/lib/types"
import { ORDERS_COLLECTION } from "@/lib/firestore-paths"
import { useQuery } from "@tanstack/react-query"
import { fetchBranches } from "@/lib/settings.service"
import { fetchProducts } from "@/lib/products.service"

export interface UseOrderDataReturn {
  branches: Branch[]
  allBranches: Branch[]
  products: Product[]
  loading: boolean
  fetchBranches: () => Promise<void>
  fetchProducts: () => Promise<void>
  loadExistingOrder: (orderId: string) => Promise<Order | null>
}

/**
 * Hook para manejar la carga de datos necesarios para el formulario de pedidos
 */
export function useOrderData(): UseOrderDataReturn {
  const { user } = useAuth()
  const [loadingExistingOrder, setLoadingExistingOrder] = useState(false)

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: fetchBranches,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const allBranches = branchesQuery.data ?? []
  const products = productsQuery.data ?? []

  const branches = useMemo(() => {
    if (!user) return allBranches

    if (user.role === "branch" && user.branchId) {
      return allBranches.filter((branch) => branch.id !== user.branchId)
    }

    if (user.role === "factory") {
      return allBranches.filter((branch) => branch.type === "branch")
    }

    return allBranches
  }, [allBranches, user])

  const loadExistingOrder = useCallback(async (orderId: string): Promise<Order | null> => {
    try {
      setLoadingExistingOrder(true)
      const orderDoc = await getDoc(doc(db, ORDERS_COLLECTION, orderId))
      
      if (orderDoc.exists()) {
        const orderData = orderDoc.data()
        return { id: orderId, ...orderData } as Order
      }
      return null
    } catch (error) {
      console.error("Error al cargar pedido:", error)
      return null
    } finally {
      setLoadingExistingOrder(false)
    }
  }, [])

  return {
    branches,
    allBranches,
    products,
    loading: branchesQuery.isLoading || productsQuery.isLoading || loadingExistingOrder,
    fetchBranches: async () => {
      await branchesQuery.refetch()
    },
    fetchProducts: async () => {
      await productsQuery.refetch()
    },
    loadExistingOrder,
  }
}

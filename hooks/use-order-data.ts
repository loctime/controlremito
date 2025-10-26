import { useState, useEffect, useCallback } from "react"
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Branch, Product, Order } from "@/lib/types"

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
  const [branches, setBranches] = useState<Branch[]>([])
  const [allBranches, setAllBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  const fetchBranches = useCallback(async () => {
    try {
      const q = query(collection(db, "apps/controld/branches"), where("active", "==", true))
      const snapshot = await getDocs(q)
      const branchesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Branch[]

      // Guardar todas las sucursales sin filtrar
      setAllBranches(branchesData)

      // Filtrar: si es sucursal, solo mostrar fábricas y otras sucursales (no la propia)
      const filtered =
        user?.role === "branch"
          ? branchesData.filter((b) => b.id !== user.branchId)
          : user?.role === "factory"
            ? branchesData.filter((b) => b.type === "branch")
            : branchesData

      setBranches(filtered)
    } catch (error) {
      console.error("[v0] Error al cargar sucursales:", error)
    }
  }, [user])

  const fetchProducts = useCallback(async () => {
    try {
      const q = query(collection(db, "apps/controld/products"), where("active", "==", true))
      const snapshot = await getDocs(q)
      const productsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Product[]
      setProducts(productsData)
    } catch (error) {
      console.error("[v0] Error al cargar productos:", error)
    }
  }, [])

  const loadExistingOrder = useCallback(async (orderId: string): Promise<Order | null> => {
    try {
      setLoading(true)
      const orderDoc = await getDoc(doc(db, "apps/controld/orders", orderId))
      
      if (orderDoc.exists()) {
        const orderData = orderDoc.data()
        return { id: orderId, ...orderData } as Order
      }
      return null
    } catch (error) {
      console.error("Error al cargar pedido:", error)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Cargar datos al inicializar
  useEffect(() => {
    if (user) {
      fetchBranches()
      fetchProducts()
    }
  }, [user, fetchBranches, fetchProducts])

  return {
    branches,
    allBranches,
    products,
    loading,
    fetchBranches,
    fetchProducts,
    loadExistingOrder,
  }
}

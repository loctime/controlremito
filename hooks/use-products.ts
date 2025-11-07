import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchProducts, createProduct, updateProduct, deleteProduct, bulkImportProducts } from '@/lib/products.service'
import { useAuth } from '@/lib/auth-context'
import { useToast } from './use-toast'
import type { Product } from '@/lib/types'

// Hook para obtener productos
export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })
}

// Hook para crear producto
export const useCreateProduct = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (productData: Omit<Product, "id" | "createdAt" | "createdBy" | "active">) => {
      if (!user) throw new Error('Usuario no autenticado')
      return createProduct(productData, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({
        title: "Producto creado",
        description: "El producto se creó correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al crear producto:", error)
      toast({
        title: "Error",
        description: "No se pudo crear el producto",
        variant: "destructive",
      })
    },
  })
}

// Hook para actualizar producto
export const useUpdateProduct = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ productId, productData }: { productId: string; productData: Partial<Product> }) => {
      return updateProduct(productId, productData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({
        title: "Producto actualizado",
        description: "El producto se actualizó correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al actualizar producto:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el producto",
        variant: "destructive",
      })
    },
  })
}

// Hook para eliminar producto
export const useDeleteProduct = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (productId: string) => {
      return deleteProduct(productId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({
        title: "Producto eliminado",
        description: "El producto se eliminó correctamente",
      })
    },
    onError: (error) => {
      console.error("Error al eliminar producto:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el producto",
        variant: "destructive",
      })
    },
  })
}

// Hook para importación masiva
export const useBulkImportProducts = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (products: Partial<Product>[]) => {
      if (!user) throw new Error('Usuario no autenticado')
      return bulkImportProducts(products, user.id)
    },
    onSuccess: (_, products) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({
        title: "✅ Importación exitosa",
        description: `Se importaron ${products.length} productos correctamente`,
      })
    },
    onError: (error) => {
      console.error("Error en importación masiva:", error)
      toast({
        title: "Error",
        description: "Hubo un problema al importar algunos productos",
        variant: "destructive",
      })
    },
  })
}

import { useState, useCallback, useRef, useEffect } from "react"
import { useToast } from "./use-toast"
import { useAuth } from "@/lib/auth-context"
import { collection, addDoc, updateDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getReplacementQueue } from "@/lib/replacement-service"
import type { Branch, Product, Template, DayOfWeek, Order } from "@/lib/types"

export interface OrderFormData {
  toBranchId: string
  notes: string
  items: { productId: string; productName: string; quantity: number; unit: string; isPending?: boolean }[]
  templateId: string
  allowedSendDays: DayOfWeek[]
}

export interface UseNewOrderFormReturn {
  formData: OrderFormData
  setFormData: React.Dispatch<React.SetStateAction<OrderFormData>>
  loading: boolean
  saving: boolean
  lastSaved: Date | null
  createdOrderId: string | null
  setCreatedOrderId: React.Dispatch<React.SetStateAction<string | null>>
  editingOrderId: string | null
  setEditingOrderId: React.Dispatch<React.SetStateAction<string | null>>
  addItem: () => void
  removeItem: (index: number) => void
  updateItem: (index: number, field: string, value: string | number) => void
  loadTemplate: (templateId: string, products: Product[], templates: Template[]) => Promise<void>
  handleSubmit: (e: React.FormEvent, allBranches: Branch[]) => Promise<void>
  handleSaveDraft: () => Promise<void>
  handleSaveAsTemplate: () => Promise<void>
  clearDraft: () => void
}

/**
 * Hook para manejar el formulario de nuevo pedido
 */
export function useNewOrderForm(): UseNewOrderFormReturn {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [formData, setFormData] = useState<OrderFormData>({
    toBranchId: "",
    notes: "",
    items: [],
    templateId: "",
    allowedSendDays: [],
  })
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const draftOrderIdRef = useRef<string | null>(null)

  // Cargar borrador desde localStorage al inicializar
  const loadDraftFromLocalStorage = useCallback(() => {
    if (!user?.branchId) return
    
    try {
      const draftKey = `order_draft_${user.branchId}_${user.id}`
      const savedDraft = localStorage.getItem(draftKey)
      
      if (savedDraft) {
        const draftData = JSON.parse(savedDraft)
        
        // Verificar que el borrador no sea muy antiguo (más de 7 días)
        const draftDate = new Date(draftData.timestamp)
        const now = new Date()
        const daysDiff = (now.getTime() - draftDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysDiff < 7) {
          // Asegurar que todos los items tengan el campo isPending
          const formDataWithPending = {
            ...draftData.formData,
            items: draftData.formData.items?.map((item: any) => ({
              ...item,
              isPending: item.isPending || false,
            })) || []
          }
          setFormData(formDataWithPending)
          setLastSaved(draftDate)
          
          // Si hay un ID de pedido guardado, cargar ese pedido
          if (draftData.orderId) {
            draftOrderIdRef.current = draftData.orderId
          }
          
          toast({
            title: "Borrador recuperado",
            description: "Se encontró un borrador guardado automáticamente",
          })
        } else {
          // Eliminar borrador antiguo
          localStorage.removeItem(draftKey)
        }
      }
    } catch (error) {
      console.error("Error al cargar borrador desde localStorage:", error)
    }
  }, [user, toast])

  // Guardar borrador en localStorage
  const saveDraftToLocalStorage = useCallback((data: OrderFormData, orderId?: string) => {
    if (!user?.branchId) return
    
    try {
      const draftKey = `order_draft_${user.branchId}_${user.id}`
      const draftData = {
        formData: {
          ...data,
          items: data.items?.map((item: any) => ({
            ...item,
            isPending: item.isPending || false,
          })) || []
        },
        orderId: orderId || draftOrderIdRef.current,
        timestamp: new Date().toISOString(),
      }
      
      localStorage.setItem(draftKey, JSON.stringify(draftData))
    } catch (error) {
      console.error("Error al guardar borrador en localStorage:", error)
    }
  }, [user])

  // Limpiar borrador del localStorage
  const clearDraftFromLocalStorage = useCallback(() => {
    if (!user?.branchId) return
    
    try {
      const draftKey = `order_draft_${user.branchId}_${user.id}`
      localStorage.removeItem(draftKey)
      draftOrderIdRef.current = null
    } catch (error) {
      console.error("Error al limpiar borrador del localStorage:", error)
    }
  }, [user])

  // Guardar borrador en Firestore
  const saveDraftToFirestore = useCallback(async (data: OrderFormData, allBranches: Branch[]) => {
    if (!user || !user.branchId) return null
    
    try {
      setSaving(true)
      
      const fromBranch = allBranches.find((b) => b.id === user.branchId)
      const toBranch = allBranches.find((b) => b.id === data.toBranchId)
      
      if (!fromBranch) {
        throw new Error(`No se encontró la sucursal de origen (ID: ${user.branchId})`)
      }

      const orderData: any = {
        fromBranchId: user.branchId,
        fromBranchName: fromBranch.name,
        toBranchId: data.toBranchId || "",
        toBranchName: toBranch?.name || "",
        status: "draft",
        items: data.items.map((item: any) => ({
          ...item,
          id: item.id || `${Date.now()}-${Math.random()}`,
          status: "pending",
          isPending: item.isPending || false,
        })),
        updatedAt: new Date(),
        createdBy: user.id,
        createdByName: user.name,
        notes: data.notes,
        allowedSendDays: data.allowedSendDays,
      }

      // Solo agregar templateId si tiene un valor válido
      if (data.templateId) {
        orderData.templateId = data.templateId
      }

      let orderId: string

      if (draftOrderIdRef.current) {
        // Actualizar pedido existente
        await updateDoc(doc(db, "apps/controld/orders", draftOrderIdRef.current), orderData)
        orderId = draftOrderIdRef.current
      } else {
        // Crear nuevo pedido en borrador
        orderData.orderNumber = `PED-${Date.now()}`
        orderData.createdAt = new Date()
        
        const docRef = await addDoc(collection(db, "apps/controld/orders"), orderData)
        orderId = docRef.id
        draftOrderIdRef.current = orderId
      }

      setLastSaved(new Date())
      return orderId
    } catch (error) {
      console.error("Error al guardar borrador en Firestore:", error)
      return null
    } finally {
      setSaving(false)
    }
  }, [user])

  // Función de guardado automático
  const autoSave = useCallback(async (allBranches: Branch[]) => {
    if (!user || !formData.toBranchId || formData.items.length === 0) {
      return
    }

    try {
      const orderId = await saveDraftToFirestore(formData, allBranches)
      if (orderId) {
        saveDraftToLocalStorage(formData, orderId)
      }
    } catch (error) {
      console.error("Error en guardado automático:", error)
    }
  }, [user, formData, saveDraftToFirestore, saveDraftToLocalStorage])

  // Configurar guardado automático cuando cambia el formData
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Solo guardar automáticamente si hay datos mínimos
    if (formData.toBranchId && formData.items.length > 0) {
      autoSaveTimeoutRef.current = setTimeout(() => {
        // Necesitamos acceso a allBranches aquí, pero no lo tenemos en el hook
        // Esto se manejará en el componente principal
      }, 30000) // Guardar cada 30 segundos
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [formData, autoSave])

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  // Cargar borrador al inicializar
  useEffect(() => {
    loadDraftFromLocalStorage()
  }, [loadDraftFromLocalStorage])

  const addItem = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { productId: "", productName: "", quantity: 0, unit: "", isPending: false }],
    }))
  }, [])

  const removeItem = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }, [])

  const updateItem = useCallback((index: number, field: string, value: string | number) => {
    setFormData(prev => {
      const newItems = [...prev.items]
      if (field === "productId") {
        // El producto se manejará en el componente que llama a esta función
        newItems[index] = { ...newItems[index], productId: value as string }
      } else {
        newItems[index] = { ...newItems[index], [field]: value }
      }
      return { ...prev, items: newItems }
    })
  }, [])

  const loadTemplate = useCallback(async (templateId: string, products: Product[], templates: Template[]) => {
    const template = templates.find((t) => t.id === templateId)
    if (!template) {
      toast({
        title: "Plantilla no encontrada",
        description: "La plantilla seleccionada no existe o no tienes permisos para acceder a ella",
        variant: "destructive",
      })
      return
    }

    try {
      // Validar que la plantilla tenga items
      if (!template.items || template.items.length === 0) {
        toast({
          title: "Plantilla vacía",
          description: "La plantilla seleccionada no tiene productos",
          variant: "destructive",
        })
        return
      }

      // Validar que los productos de la plantilla existan
      const validItems = template.items.filter(item => {
        const productExists = products.find(p => p.id === item.productId)
        if (!productExists) {
          console.warn(`[v0] Producto de plantilla no encontrado: ${item.productId}`)
        }
        return productExists
      })

      if (validItems.length !== template.items.length) {
        toast({
          title: "Advertencia",
          description: `Se cargaron ${validItems.length} de ${template.items.length} productos. Algunos productos de la plantilla no están disponibles.`,
          variant: "destructive",
        })
      }

      // Obtener productos pendientes para esta sucursal
      let pendingProducts: { [productId: string]: number } = {}
      if (user?.branchId) {
        try {
          const replacementQueue = await getReplacementQueue(user.branchId)
          
          if (replacementQueue && replacementQueue.items) {
            // Crear mapa de productos pendientes
            replacementQueue.items
              .filter(item => item.status === "pending")
              .forEach(item => {
                pendingProducts[item.productId] = (pendingProducts[item.productId] || 0) + item.quantity
              })
          }
        } catch (error) {
          console.warn("Error al cargar productos pendientes:", error)
        }
      }

      // Crear items con cantidades pre-llenadas si hay productos pendientes
      const itemsWithPendingQuantities = validItems.map((item) => {
        const pendingQuantity = pendingProducts[item.productId] || 0
        return {
          ...item,
          quantity: pendingQuantity, // Pre-llenar con cantidad pendiente
          isPending: pendingQuantity > 0 // Marcar si es pendiente
        }
      })

      setFormData(prev => ({
        ...prev,
        items: itemsWithPendingQuantities,
        templateId: template.id,
        allowedSendDays: [], // Siempre empezar con array vacío para evitar errores
      }))
      
      const pendingCount = itemsWithPendingQuantities.filter(item => item.isPending).length
      const message = pendingCount > 0 
        ? `Se cargaron ${validItems.length} productos de la plantilla "${template.name}". ${pendingCount} productos tienen cantidades pendientes pre-llenadas.`
        : `Se cargaron ${validItems.length} productos de la plantilla "${template.name}".`
      
      toast({
        title: "✅ Plantilla cargada",
        description: message,
      })
    } catch (error) {
      console.error("[v0] Error al cargar plantilla:", error)
      toast({
        title: "Error al cargar plantilla",
        description: "Ocurrió un error al procesar la plantilla",
        variant: "destructive",
      })
    }
  }, [user, toast])

  const handleSubmit = useCallback(async (e: React.FormEvent, allBranches: Branch[]) => {
    e.preventDefault()

    // Validaciones
    if (!user || !user.branchId) {
      toast({
        title: "Error de autenticación",
        description: "No se pudo identificar tu sucursal. Por favor, cierra sesión y vuelve a iniciar sesión.",
        variant: "destructive",
      })
      return
    }

    if (!formData.toBranchId) {
      toast({
        title: "Destino requerido",
        description: "Debes seleccionar un destino para el pedido",
        variant: "destructive",
      })
      return
    }

    if (formData.items.length === 0) {
      toast({
        title: "Productos requeridos",
        description: "Debes agregar al menos un producto al pedido",
        variant: "destructive",
      })
      return
    }

    // Validar que todos los items tengan producto seleccionado
    const itemsWithoutProduct = formData.items.filter(item => !item.productId || !item.productName)
    if (itemsWithoutProduct.length > 0) {
      toast({
        title: "Productos incompletos",
        description: "Todos los productos deben estar completamente seleccionados",
        variant: "destructive",
      })
      return
    }

    // Validar cantidades
    const itemsWithInvalidQuantity = formData.items.filter(item => item.quantity < 0)
    if (itemsWithInvalidQuantity.length > 0) {
      toast({
        title: "Cantidades inválidas",
        description: "Todas las cantidades deben ser mayores o iguales a 0",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const fromBranch = allBranches.find((b) => b.id === user.branchId)
      const toBranch = allBranches.find((b) => b.id === formData.toBranchId)

      if (!fromBranch) {
        throw new Error(`No se encontró la sucursal de origen (ID: ${user.branchId})`)
      }

      if (!toBranch) {
        throw new Error(`No se encontró la sucursal de destino (ID: ${formData.toBranchId})`)
      }

      // Generar número de pedido
      const orderNumber = `PED-${Date.now()}`

      const orderData: any = {
        orderNumber,
        fromBranchId: user.branchId,
        fromBranchName: fromBranch.name,
        toBranchId: formData.toBranchId,
        toBranchName: toBranch.name,
        status: "draft",
        items: formData.items.map((item) => ({
          ...item,
          id: `${Date.now()}-${Math.random()}`,
          status: "pending",
          isPending: item.isPending || false,
        })),
        createdAt: new Date(),
        createdBy: user.id,
        createdByName: user.name,
        notes: formData.notes,
        allowedSendDays: formData.allowedSendDays,
      }

      // Solo agregar templateId si tiene un valor válido
      if (formData.templateId) {
        orderData.templateId = formData.templateId
      }

      if (editingOrderId) {
        // Actualizar pedido existente
        await updateDoc(doc(db, "apps/controld/orders", editingOrderId), orderData)
        
        toast({
          title: "✅ Pedido actualizado exitosamente",
          description: `El pedido ${orderNumber} se actualizó correctamente`,
        })
      } else {
        // Crear nuevo pedido
        const docRef = await addDoc(collection(db, "apps/controld/orders"), orderData)
        
        toast({
          title: "✅ Pedido creado exitosamente",
          description: `El pedido ${orderNumber} se creó correctamente`,
        })

        // Establecer el ID del pedido creado para mostrar la vista de detalles
        setCreatedOrderId(docRef.id)
      }

      // Limpiar borrador del localStorage y resetear estado
      clearDraftFromLocalStorage()
      draftOrderIdRef.current = null
    } catch (error: any) {
      console.error("❌ [DEBUG] Error detallado al crear pedido:", error)
      
      let errorMessage = "No se pudo crear el pedido"
      
      // Mensajes de error más específicos
      if (error.code === "permission-denied") {
        errorMessage = "No tienes permisos para crear pedidos. Contacta al administrador."
      } else if (error.code === "unavailable") {
        errorMessage = "Servicio temporalmente no disponible. Intenta de nuevo en unos minutos."
      } else if (error.code === "failed-precondition") {
        errorMessage = "Los datos del pedido no son válidos. Verifica la información e intenta de nuevo."
      } else if (error.code === "invalid-argument") {
        if (error.message?.includes("undefined")) {
          errorMessage = "Error en los datos del pedido. Por favor, recarga la página e intenta de nuevo."
        } else {
          errorMessage = "Los datos del pedido no son válidos. Verifica la información e intenta de nuevo."
        }
      } else if (error.message?.includes("blocked")) {
        errorMessage = "Conexión bloqueada. Desactiva el bloqueador de anuncios o verifica tu conexión a internet."
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "❌ Error al crear pedido",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, formData, editingOrderId, toast, clearDraftFromLocalStorage])

  const handleSaveDraft = useCallback(async () => {
    if (!formData.toBranchId || formData.items.length === 0) {
      toast({
        title: "Datos insuficientes",
        description: "Selecciona un destino y agrega al menos un producto para guardar el borrador",
        variant: "destructive",
      })
      return
    }

    try {
      // Necesitamos acceso a allBranches aquí, pero no lo tenemos en el hook
      // Esto se manejará en el componente principal
      toast({
        title: "Error",
        description: "Función de guardado de borrador no implementada completamente",
        variant: "destructive",
      })
    } catch (error) {
      console.error("Error al guardar borrador:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el borrador",
        variant: "destructive",
      })
    }
  }, [formData, toast])

  const handleSaveAsTemplate = useCallback(async () => {
    if (!user || !formData.toBranchId || formData.items.length === 0) {
      toast({
        title: "Datos insuficientes",
        description: "Selecciona un destino y agrega al menos un producto para crear la plantilla",
        variant: "destructive",
      })
      return
    }

    // Validar que todos los items tengan producto seleccionado
    const itemsWithoutProduct = formData.items.filter(item => !item.productId || !item.productName)
    if (itemsWithoutProduct.length > 0) {
      toast({
        title: "Productos incompletos",
        description: "Todos los productos deben estar completamente seleccionados",
        variant: "destructive",
      })
      return
    }

    try {
      const templateName = prompt("Nombre para tu plantilla personal:", "Mi plantilla")
      
      if (!templateName) return // Usuario canceló

      const templateData = {
        name: templateName,
        description: formData.notes || "",
        items: formData.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: 0, // Empezar en 0, el usuario ingresará cantidades al usarla
          unit: item.unit
        })),
        createdBy: user.id,
        createdByName: user.name,
        branchId: user.branchId,
        type: "personal" as const,
        createdAt: new Date(),
        active: true,
        destinationBranchIds: [formData.toBranchId],
        allowedSendDays: formData.allowedSendDays || []
      }

      await addDoc(collection(db, "apps/controld/templates"), templateData)

      toast({
        title: "✅ Plantilla personal creada",
        description: `La plantilla "${templateName}" se creó correctamente. Ahora puedes crear el pedido si lo deseas.`,
      })
    } catch (error) {
      console.error("Error al guardar plantilla personal:", error)
      toast({
        title: "Error",
        description: "No se pudo crear la plantilla personal",
        variant: "destructive",
      })
    }
  }, [user, formData, toast])

  const clearDraft = useCallback(() => {
    clearDraftFromLocalStorage()
    setFormData({
      toBranchId: "",
      notes: "",
      items: [],
      templateId: "",
      allowedSendDays: [],
    })
    setCreatedOrderId(null)
    setEditingOrderId(null)
  }, [clearDraftFromLocalStorage])

  return {
    formData,
    setFormData,
    loading,
    saving,
    lastSaved,
    createdOrderId,
    setCreatedOrderId,
    editingOrderId,
    setEditingOrderId,
    addItem,
    removeItem,
    updateItem,
    loadTemplate,
    handleSubmit,
    handleSaveDraft,
    handleSaveAsTemplate,
    clearDraft,
  }
}

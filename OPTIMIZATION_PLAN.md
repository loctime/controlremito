# 🚀 Plan de Optimización del Dashboard

## Problemas Identificados

### 1. **Re-renders Innecesarios** 🔴 CRÍTICO
- Los componentes se re-renderizan aunque no cambien sus props
- Las funciones se recrean en cada render
- Los cálculos se repiten innecesariamente

### 2. **Queries Ineficientes** 🟡 IMPORTANTE
- En `useOrders`: Se hace un `getDoc()` por cada pedido para obtener el nombre de la plantilla
- Esto puede causar muchas lecturas a Firestore si hay muchos pedidos
- Ejemplo: 50 pedidos = 50 llamadas a Firebase adicionales

### 3. **Falta de Estados de Carga** 🟡 IMPORTANTE
- Los hooks no retornan estados de `loading` o `error`
- El usuario no sabe si los datos están cargando o si hubo un error

### 4. **Memoria no liberada** 🟡 IMPORTANTE
- En `useOrders`, el hook hace llamadas async dentro del onSnapshot
- Si el componente se desmonta, las promesas siguen ejecutándose

### 5. **Bundle Size** 🟢 MENOR
- No se usan lazy imports para componentes pesados
- Todos los componentes se cargan al inicio

## Soluciones Propuestas

### 1. React.memo + useCallback + useMemo
```typescript
// ❌ ANTES: Se recrea en cada render
const updateItemQuantity = (itemIndex: number, newQuantity: number) => { ... }

// ✅ DESPUÉS: Solo se recrea cuando cambian las dependencias
const updateItemQuantity = useCallback((itemIndex: number, newQuantity: number) => {
  // ...
}, [editFormData])
```

### 2. Optimizar Query de Plantillas
```typescript
// ❌ ANTES: getDoc() por cada pedido (N queries)
ordersData.map(async (order) => {
  const templateDoc = await getDoc(...)
})

// ✅ DESPUÉS: Un solo query con todos los IDs
const templateIds = [...new Set(ordersData.map(o => o.templateId))]
const templatesQuery = query(templatesRef, where('id', 'in', templateIds))
```

### 3. Estados de Carga y Error
```typescript
// ✅ DESPUÉS
export function useOrders(user, status) {
  const [orders, setOrders] = useState<OrderWithTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  return { orders, loading, error }
}
```

### 4. Cancelación de Promesas
```typescript
// ✅ DESPUÉS: Usar AbortController o flag
let isMounted = true

useEffect(() => {
  // ... queries
  
  return () => {
    isMounted = false // Prevenir setState después de desmontar
  }
}, [])
```

### 5. Lazy Loading
```typescript
// ✅ DESPUÉS
const BranchDashboard = lazy(() => import('./branch-dashboard'))
const FactoryDeliveryDashboard = lazy(() => import('./factory-delivery-dashboard'))
```

## Impacto Estimado

| Optimización | Impacto en Performance | Dificultad | Prioridad |
|--------------|------------------------|------------|-----------|
| React.memo + useCallback | 🔥 Alto (30-50% menos renders) | Baja | 🔴 Alta |
| Optimizar queries | 🔥🔥 Muy Alto (90% menos lecturas FB) | Media | 🔴 Alta |
| Loading/Error states | 🎨 UX (mejor experiencia) | Baja | 🟡 Media |
| Cancelación promesas | 🐛 Previene bugs | Baja | 🟡 Media |
| Lazy loading | 📦 Bundle (reduce 20-30%) | Baja | 🟢 Baja |

## ¿Quieres que implemente estas optimizaciones?


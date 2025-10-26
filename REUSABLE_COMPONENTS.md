# 🔄 Componentes Reutilizables

Este documento describe los componentes y hooks reutilizables creados para mejorar la consistencia y reducir la duplicación de código en la aplicación.

## 📦 Componentes UI

### 1. LoadingSpinner
Componente para mostrar estados de carga de forma consistente.

```tsx
import { LoadingSpinner } from "@/components/ui/loading-spinner"

// Uso básico
<LoadingSpinner />

// Con texto
<LoadingSpinner text="Cargando plantillas..." />

// Diferentes tamaños
<LoadingSpinner size="sm" />
<LoadingSpinner size="md" />
<LoadingSpinner size="lg" />
```

### 2. EmptyState
Componente para mostrar estados vacíos con iconos y acciones.

```tsx
import { EmptyState } from "@/components/ui/empty-state"
import { FileText } from "lucide-react"

<EmptyState
  icon={FileText}
  title="No hay plantillas disponibles"
  description="El administrador aún no ha creado plantillas para tu sucursal."
  action={{
    label: "Crear plantilla",
    onClick: () => handleCreateTemplate()
  }}
/>
```

### 3. ActionButton
Botón de acción con icono y estado de carga.

```tsx
import { ActionButton } from "@/components/ui/action-button"
import { Edit, Trash2 } from "lucide-react"

<ActionButton
  icon={Edit}
  label="Editar"
  onClick={() => handleEdit()}
  variant="outline"
  size="sm"
/>

<ActionButton
  icon={Trash2}
  label="Eliminar"
  onClick={() => handleDelete()}
  variant="destructive"
  loading={isDeleting}
/>
```

### 4. DataTable
Tabla reutilizable con funcionalidades comunes.

```tsx
import { DataTable } from "@/components/ui/data-table"

const columns = [
  {
    key: 'name',
    header: 'Nombre',
    render: (item) => <span>{item.name}</span>
  },
  {
    key: 'status',
    header: 'Estado',
    render: (item) => <StatusBadge status={item.status} />
  },
  {
    key: 'actions',
    header: 'Acciones',
    render: (item) => (
      <ActionButton
        icon={Edit}
        label="Editar"
        onClick={() => handleEdit(item.id)}
      />
    )
  }
]

<DataTable
  data={templates}
  columns={columns}
  emptyMessage="No hay plantillas disponibles"
  loading={isLoading}
/>
```

### 5. StatusBadge
Badge para mostrar estados de forma consistente.

```tsx
import { StatusBadge } from "@/components/ui/status-badge"

<StatusBadge status="active" />
<StatusBadge status="pending" />
<StatusBadge status="cancelled" />
<StatusBadge status="ok" />
<StatusBadge status="no" />
```

### 6. CollapsibleSection
Sección colapsable reutilizable.

```tsx
import { CollapsibleSection } from "@/components/dashboard/collapsible-section"

<CollapsibleSection
  title="Plantillas Oficiales"
  showCount={templates.length}
  countLabel="plantillas"
  defaultOpen={true}
>
  <div className="grid gap-4">
    {templates.map(template => (
      <TemplateCard key={template.id} template={template} />
    ))}
  </div>
</CollapsibleSection>
```

## 🪝 Hooks

### 1. useCollapsible
Hook para manejar estados de colapso individual.

```tsx
import { useCollapsible } from "@/hooks/use-collapsible"

function MyComponent() {
  const { isOpen, toggle, open, close } = useCollapsible(false)
  
  return (
    <div>
      <button onClick={toggle}>
        {isOpen ? 'Ocultar' : 'Mostrar'}
      </button>
      {isOpen && <div>Contenido colapsable</div>}
    </div>
  )
}
```

### 2. useCollapsibleSet
Hook para manejar múltiples elementos colapsables.

```tsx
import { useCollapsibleSet } from "@/hooks/use-collapsible"

function MyComponent() {
  const { isCollapsed, toggle, collapseAll, expandAll } = useCollapsibleSet()
  
  return (
    <div>
      <button onClick={expandAll}>Expandir todo</button>
      <button onClick={collapseAll}>Colapsar todo</button>
      
      {items.map(item => (
        <div key={item.id}>
          <button onClick={() => toggle(item.id)}>
            {isCollapsed(item.id) ? '▼' : '▶'}
            {item.name}
          </button>
          {!isCollapsed(item.id) && <div>{item.content}</div>}
        </div>
      ))}
    </div>
  )
}
```

## 🎯 Beneficios

### ✅ Consistencia
- Todos los componentes siguen el mismo patrón de diseño
- Estados de carga, vacío y error se muestran de forma uniforme
- Colores y estilos consistentes en toda la aplicación

### ✅ Reutilización
- Reduce la duplicación de código
- Componentes probados y optimizados
- Fácil mantenimiento y actualizaciones

### ✅ Productividad
- Desarrollo más rápido con componentes pre-construidos
- Menos tiempo en decisiones de diseño
- Código más limpio y legible

### ✅ Mantenibilidad
- Cambios centralizados en un solo lugar
- Fácil testing de componentes individuales
- Documentación clara de uso

## 📝 Ejemplos de Refactorización

### Antes (Código duplicado):
```tsx
// En múltiples archivos
<div className="flex items-center justify-center py-12">
  <Loader2 className="h-8 w-8 animate-spin text-primary" />
  <span className="ml-2 text-muted-foreground">Cargando...</span>
</div>
```

### Después (Componente reutilizable):
```tsx
<LoadingSpinner text="Cargando..." size="lg" />
```

### Antes (Lógica de colapso duplicada):
```tsx
const [collapsed, setCollapsed] = useState(false)
const toggle = () => setCollapsed(!collapsed)
```

### Después (Hook reutilizable):
```tsx
const { isOpen, toggle } = useCollapsible()
```

## 🚀 Próximos Pasos

1. **Migrar componentes existentes** a usar estos componentes reutilizables
2. **Crear más componentes** según necesidades específicas
3. **Documentar patrones** de uso común
4. **Establecer guías** de diseño y desarrollo
5. **Crear tests** para componentes reutilizables

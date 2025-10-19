# Refactorización del Dashboard

## 📊 Resumen

Se refactorizó el archivo `app/dashboard/page.tsx` de **2153 líneas** a solo **27 líneas**, mejorando significativamente la mantenibilidad y organización del código.

## 🏗️ Nueva Estructura

### Hooks Personalizados (`hooks/`)

- **`use-orders.ts`**: Hook para gestionar pedidos por estado (sent, assembling, in_transit)
- **`use-templates.ts`**: Hook para cargar plantillas en tiempo real según el rol del usuario
- **`use-draft-orders.ts`**: Hook para gestionar borradores de pedidos de sucursales

### Componentes de Dashboard (`components/dashboard/`)

#### Componentes Principales por Rol
- **`branch-dashboard.tsx`**: Dashboard completo para sucursales
- **`factory-delivery-dashboard.tsx`**: Dashboard unificado para fábrica y delivery

#### Componentes Reutilizables
- **`template-card.tsx`**: Tarjeta de plantilla con edición inline
- **`orders-table.tsx`**: Tabla de pedidos pendientes (con aceptación)
- **`assembling-orders-table.tsx`**: Tabla de pedidos en armando
- **`in-transit-orders-table.tsx`**: Tabla de pedidos en camino (con recepción para sucursales)
- **`confirmation-dialogs.tsx`**: Diálogos de confirmación (aceptar individual y múltiple)

## ✨ Beneficios

1. **Separación de responsabilidades**: Cada componente tiene una función clara y específica
2. **Reutilización**: Los hooks y componentes pueden reutilizarse en diferentes partes de la aplicación
3. **Mantenibilidad**: Es mucho más fácil encontrar y modificar código específico
4. **Testabilidad**: Componentes más pequeños son más fáciles de probar
5. **Legibilidad**: El código es más claro y fácil de entender
6. **Escalabilidad**: Es más fácil agregar nuevas funcionalidades

## 📁 Estructura de Archivos

```
app/dashboard/
  └── page.tsx (27 líneas) ← Antes: 2153 líneas

components/dashboard/
  ├── branch-dashboard.tsx
  ├── factory-delivery-dashboard.tsx
  ├── template-card.tsx
  ├── orders-table.tsx
  ├── assembling-orders-table.tsx
  ├── in-transit-orders-table.tsx
  └── confirmation-dialogs.tsx

hooks/
  ├── use-orders.ts
  ├── use-templates.ts
  └── use-draft-orders.ts
```

## 🔄 Flujo de Datos

### Sucursal (Branch)
1. Hook `useTemplates` carga plantillas disponibles
2. Hook `useDraftOrders` gestiona borradores
3. Hook `useOrders` (assembling, in_transit) muestra estado de pedidos
4. Componente `TemplateCard` permite crear/editar/enviar pedidos
5. Tablas muestran pedidos en proceso

### Fábrica/Delivery
1. Hook `useOrders` (sent, assembling, in_transit) carga pedidos
2. Tablas específicas para cada estado con acciones apropiadas
3. Diálogos de confirmación para operaciones críticas

## 🚀 Cómo Extender

### Agregar un nuevo tipo de pedido:
1. Crear un nuevo hook si necesita lógica específica
2. Crear un componente de tabla si necesita visualización específica
3. Agregar la lógica al dashboard correspondiente

### Agregar un nuevo rol:
1. Crear un nuevo componente `*-dashboard.tsx`
2. Reutilizar hooks y componentes existentes
3. Actualizar `app/dashboard/page.tsx` para incluir el nuevo rol

## 📝 Notas

- Todos los componentes siguen usando Firebase Realtime Listeners (onSnapshot)
- La lógica de negocio se mantiene igual, solo se reorganizó
- Se mantiene compatibilidad total con la versión anterior
- No se modificaron tipos ni estructuras de datos de Firestore


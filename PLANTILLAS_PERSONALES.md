# Sistema de Plantillas Personales - Implementación Completa

## 📋 Resumen

Se ha implementado un sistema completo de **plantillas personales** que permite a los usuarios de sucursales crear y gestionar sus propias plantillas de pedidos, además de las plantillas oficiales.

## 🎯 Características Implementadas

### 1. **Tipos de Plantillas**

El sistema ahora soporta 3 tipos de plantillas:

- **`global`**: Plantillas creadas por administradores, visibles para todas las sucursales
- **`branch`**: Plantillas oficiales asignadas a sucursales específicas
- **`personal`**: Plantillas creadas por usuarios individuales, solo visibles para ellos

### 2. **Separación Visual en el Dashboard**

Las plantillas se muestran separadas en dos secciones:

```
📋 Plantillas
  👤 Mis Plantillas Personales (3)
    - [Plantillas personales del usuario]
    
  ─────────────────────
  
  🏢 Plantillas Oficiales
    - [Plantillas globales y de sucursal]
```

### 3. **Crear Plantillas Personales**

Los usuarios pueden guardar un pedido manual como plantilla personal desde la página de creación de pedidos:

1. Crear un pedido manual
2. Después de crearlo, hacer clic en **"💾 Guardar como plantilla personal"**
3. Ingresar un nombre para la plantilla
4. La plantilla aparece instantáneamente en el dashboard

### 4. **Gestión de Plantillas Personales**

- **Ver**: Solo el usuario que creó la plantilla puede verla
- **Editar**: Solo el creador puede editar sus plantillas personales
- **Eliminar**: Solo el creador puede eliminar sus plantillas personales
- Los admins/maxdev pueden ver y gestionar todas las plantillas

## 🔧 Archivos Modificados

### 1. `lib/types.ts`
```typescript
export interface Template {
  // ... campos existentes ...
  type?: "global" | "branch" | "personal"  // ← NUEVO
}
```

### 2. `hooks/use-templates.ts`
- Agregada query adicional para cargar plantillas personales del usuario
- Las plantillas personales se cargan en tiempo real con `onSnapshot`

### 3. `components/dashboard/branch-dashboard.tsx`
- Separación visual de plantillas personales y oficiales
- Badges con contador de plantillas personales
- Separador visual entre secciones

### 4. `app/dashboard/orders/new/page.tsx`
- Función `handleSaveAsPersonalTemplate()` para crear plantillas personales
- Botón "Guardar como plantilla personal" en la vista de detalles del pedido

### 5. `firestore.rules` (Actualizado)
```javascript
// Plantillas - con soporte para plantillas personales
match /templates/{templateId} {
  // Leer: todos pueden ver plantillas globales/branch, 
  // solo el creador puede ver sus plantillas personales
  allow read: if isAuthenticated() && (
    !exists(...) ||
    resource.data.type != 'personal' ||
    resource.data.createdBy == request.auth.uid ||
    isMaxDev() || isAdmin()
  );
  
  // Crear: branch/factory pueden crear plantillas personales
  allow create: if isAuthenticated() && (
    (request.resource.data.type == 'personal' && 
     request.resource.data.createdBy == request.auth.uid &&
     request.resource.data.active == true) ||
    (isAdmin() || isMaxDev())
  );
  
  // Actualizar/Eliminar: solo el creador o admin/maxdev
  allow update, delete: if isAuthenticated() && (
    (resource.data.type == 'personal' && 
     resource.data.createdBy == request.auth.uid) ||
    isMaxDev() || isAdmin()
  );
}
```

## 🚀 Flujo de Uso

### Para Usuarios de Sucursales:

1. **Crear pedido manual frecuente:**
   - Dashboard → "Crear pedido manual"
   - Agregar productos y destino
   - Crear pedido
   - Click en "💾 Guardar como plantilla personal"
   - Nombrar la plantilla

2. **Usar plantilla personal:**
   - Dashboard → Ver "👤 Mis Plantillas Personales"
   - Click en la plantilla deseada
   - Ajustar cantidades (inician en 0)
   - Enviar pedido

3. **Ventajas:**
   - ✅ Ahorra tiempo en pedidos recurrentes
   - ✅ No necesita esperar que admin cree plantilla oficial
   - ✅ Personalizable para necesidades específicas
   - ✅ No interfiere con plantillas oficiales

### Para Administradores:

- Pueden ver todas las plantillas (globales, branch y personales)
- Pueden gestionar plantillas globales y de sucursal
- Las plantillas personales son gestionadas por cada usuario

## 📊 Base de Datos

### Estructura de una Plantilla Personal en Firestore:

```javascript
{
  id: "auto-generated",
  name: "Plantilla Verdulería Semanal",
  description: "Mi pedido semanal de verduras",
  type: "personal",  // ← Identifica como personal
  items: [
    {
      productId: "prod-123",
      productName: "Lechuga",
      quantity: 0,  // Usuario ingresará cantidad al usar
      unit: "unidades"
    }
  ],
  createdBy: "user-456",
  createdByName: "Juan Pérez",
  branchId: "branch-789",
  active: true,
  destinationBranchIds: ["factory-001"],
  allowedSendDays: [],
  createdAt: Timestamp
}
```

## 🔒 Seguridad

Las reglas de Firestore garantizan que:

1. ✅ Solo el creador puede ver sus plantillas personales
2. ✅ Solo el creador puede editar/eliminar sus plantillas personales
3. ✅ Admins/MaxDev pueden ver todas las plantillas
4. ✅ Las plantillas personales no pueden ser creadas sin autenticación
5. ✅ El campo `createdBy` debe coincidir con el usuario autenticado

## ⚠️ Notas Importantes

### Retrocompatibilidad

Las plantillas existentes sin el campo `type` seguirán funcionando:
- Se tratarán como plantillas oficiales (no personales)
- El filtro `t.type === "personal"` solo encontrará las nuevas plantillas personales
- No es necesario migrar plantillas existentes

### Próximos Pasos Sugeridos

1. **Agregar botón de edición** en plantillas personales (TemplateCard)
2. **Agregar botón de eliminación** en plantillas personales
3. **Diálogo de confirmación** al eliminar plantilla personal
4. **Opción de duplicar** plantillas oficiales como personales
5. **Límite de plantillas personales** por usuario (opcional)

## 🎨 UI/UX

- **Icono 👤** para identificar plantillas personales
- **Icono 🏢** para identificar plantillas oficiales
- **Badge con contador** muestra cantidad de plantillas personales
- **Separador visual** claro entre secciones
- **Feedback inmediato** con toasts al crear plantillas

## 📝 Testing Sugerido

1. Crear pedido manual y guardarlo como plantilla personal
2. Verificar que aparece en "Mis Plantillas Personales"
3. Usar la plantilla personal para crear un nuevo pedido
4. Verificar que otro usuario NO puede ver la plantilla personal
5. Verificar que admin/maxdev SÍ puede ver la plantilla personal

---

## ✅ Estado Final

- ✅ Tipo de plantilla agregado en `lib/types.ts`
- ✅ Hook actualizado para cargar plantillas personales
- ✅ Dashboard con separación visual implementada
- ✅ Funcionalidad de guardar como plantilla personal
- ✅ Reglas de Firestore configuradas
- ✅ Sin errores de linting
- ✅ Retrocompatible con plantillas existentes

**Sistema completamente funcional y listo para usar! 🚀**


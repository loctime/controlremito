# 📱 Configuración PWA - Remito Control

## ✅ Implementación Completada

La aplicación ahora tiene soporte completo de Progressive Web App (PWA).

### 🎯 Características Implementadas

- ✅ **Instalación como App Nativa**: Los usuarios pueden instalar la app en sus dispositivos
- ✅ **Funcionamiento Offline**: Cache automático de recursos estáticos
- ✅ **Manifest.json**: Configuración completa con iconos y atajos
- ✅ **Service Worker**: Gestión automática vía next-pwa
- ✅ **Meta Tags**: Optimizados para iOS y Android
- ✅ **Página Offline**: Fallback cuando no hay conexión
- ✅ **Atajos de App**: Acceso rápido a Nueva Orden y Remitos

### 📦 Archivos Creados

```
public/
├── manifest.json              # Configuración PWA
├── offline.html              # Página sin conexión
├── icon-72x72.png           # Iconos (placeholder)
├── icon-96x96.png
├── icon-128x128.png
├── icon-144x144.png
├── icon-152x152.png
├── icon-192x192.png
├── icon-384x384.png
└── icon-512x512.png

next.config.mjs               # Configuración next-pwa
app/layout.tsx                # Meta tags PWA
scripts/generate-pwa-icons.js # Helper para generar iconos
```

### 🚀 Pasos para Activar

1. **Instalar dependencias:**
   ```bash
   pnpm install
   ```

2. **Generar iconos reales** (actualmente son placeholders):
   
   Opción A - Online:
   - Visita https://www.pwabuilder.com/imageGenerator
   - Sube tu logo (`public/placeholder-logo.png`)
   - Descarga los iconos generados
   - Reemplaza los archivos en `/public/`

   Opción B - Script automático:
   ```bash
   node scripts/generate-pwa-icons.js
   ```

3. **Build y deploy:**
   ```bash
   pnpm build
   pnpm start
   ```

### 📱 Cómo Instalar la PWA

#### En Chrome (Android/Desktop):
1. Visita la aplicación
2. Busca el icono "+" o "Instalar app" en la barra de direcciones
3. Click en "Instalar"

#### En Safari (iOS):
1. Abre la app en Safari
2. Tap en el botón "Compartir" (cuadrado con flecha)
3. Scroll y selecciona "Agregar a Inicio"
4. Tap "Agregar"

### ⚙️ Configuración PWA

#### next.config.mjs
```javascript
withPWA({
  dest: 'public',                    // Service Worker en /public
  register: true,                    // Auto-registro del SW
  skipWaiting: true,                 // Actualización inmediata
  disable: process.env.NODE_ENV === 'development', // Solo en prod
  reloadOnOnline: true,              // Recarga al volver online
})
```

#### manifest.json
- **Nombre**: Remito Control
- **Display**: standalone (app completa)
- **Theme**: Negro (#000000)
- **Orientación**: portrait-primary
- **Atajos**: Nueva Orden, Ver Remitos

### 🔧 Personalización

#### Cambiar colores:
```json
// public/manifest.json
{
  "theme_color": "#tu-color-aqui",
  "background_color": "#tu-color-aqui"
}
```

#### Agregar más atajos:
```json
// public/manifest.json
{
  "shortcuts": [
    {
      "name": "Tu Atajo",
      "url": "/ruta",
      "icons": [...]
    }
  ]
}
```

#### Modificar estrategia de cache:
```javascript
// next.config.mjs
withPWA({
  // ... otras opciones
  runtimeCaching: [
    // Agrega tus propias reglas de cache
  ]
})
```

### 🧪 Probar PWA en Desarrollo

Aunque PWA está deshabilitado en desarrollo, puedes probarlo:

```bash
# Build para producción
pnpm build

# Servir en modo producción
pnpm start

# O usar servidor local
npx serve@latest out -p 3000
```

### 📊 Verificar PWA

1. **Chrome DevTools:**
   - Abre DevTools (F12)
   - Ve a la pestaña "Application"
   - Revisa:
     - Manifest
     - Service Workers
     - Cache Storage

2. **Lighthouse:**
   - DevTools > Lighthouse
   - Selecciona "Progressive Web App"
   - Click "Generate report"
   - Objetivo: 90+ puntos

### 🌐 Funcionalidades Offline

El Service Worker cachea automáticamente:
- ✅ Páginas HTML
- ✅ CSS y JavaScript
- ✅ Imágenes estáticas
- ✅ Fuentes

**No se cachea automáticamente:**
- ❌ Llamadas API a Firebase
- ❌ Datos dinámicos
- ❌ Imágenes externas

Para cachear datos de Firebase, implementa:
```typescript
// Ejemplo: cache de datos con IndexedDB
// O usa Firebase Offline Persistence
```

### 🔔 Próximos Pasos (Opcional)

1. **Push Notifications:**
   - Configurar Firebase Cloud Messaging
   - Agregar permisos de notificaciones

2. **Background Sync:**
   - Sincronización de datos cuando vuelva online

3. **App Share Target:**
   - Permitir compartir contenido a la app

4. **Actualización automática:**
   - Notificar usuarios de nuevas versiones

### 🐛 Troubleshooting

#### Service Worker no se registra:
```bash
# Limpia cache
rm -rf .next
pnpm build
```

#### Los iconos no aparecen:
- Verifica que los archivos PNG existen en `/public/`
- Usa herramientas online para generarlos
- Revisa que el manifest.json apunta correctamente

#### App no se instala:
- Debe estar servida via HTTPS (o localhost)
- Verifica el manifest en DevTools
- Asegúrate que Service Worker esté activo

### 📚 Recursos

- [Next.js PWA](https://github.com/shadowwalker/next-pwa)
- [Web.dev - PWA](https://web.dev/progressive-web-apps/)
- [PWA Builder](https://www.pwabuilder.com/)
- [MDN - PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

### ✨ Beneficios PWA

- 📱 **Instalación**: Como app nativa sin tiendas
- ⚡ **Rápido**: Cache inteligente
- 🔌 **Offline**: Funciona sin internet
- 📊 **Engagement**: Hasta 3x más retención
- 💾 **Ligero**: No ocupa espacio como apps nativas
- 🔄 **Actualizaciones**: Automáticas, sin tiendas

---

**Nota:** Los iconos actuales son placeholders de texto. Reemplázalos con imágenes PNG reales antes de deployar a producción.


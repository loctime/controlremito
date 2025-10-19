# 🎨 Componente de Instalación PWA

## 📱 Banner de Instalación Flotante

El componente de instalación PWA proporciona una experiencia nativa para que los usuarios instalen la aplicación directamente desde el frontend.

### ✨ Características

- 🎯 **Detección automática**: Aparece solo cuando la PWA es instalable
- 🎨 **Diseño moderno**: Banner flotante con gradiente púrpura
- 📱 **Responsive**: Se adapta a móvil y desktop
- 🔔 **No intrusivo**: Puede descartarse fácilmente
- 💾 **Persistencia**: Recuerda si el usuario lo descartó
- ✅ **Auto-cierre**: Se oculta automáticamente después de instalar

---

## 🚀 Uso Rápido

### 1. Banner Flotante (Recomendado)

Ya está integrado en el dashboard. Aparece automáticamente:

```tsx
// app/dashboard/layout.tsx
import { InstallPWABanner } from "@/components/install-pwa"

<InstallPWABanner />
```

**Vista previa:**
```
┌─────────────────────────────────────────────┐
│  📱  Instalar Remito Control            ✕   │
│     Accede más rápido y úsala sin conexión │
│                                             │
│  [  📥 Instalar  ]  [ Ahora no ]           │
└─────────────────────────────────────────────┘
```

### 2. Botón Simple

Para navbar, settings, o cualquier lugar:

```tsx
// components/navbar.tsx
import { InstallPWAButton } from "@/components/install-pwa"

<InstallPWAButton className="ml-auto" />
```

**Vista previa:**
```
[ 📥 Instalar App ]
```

### 3. Hook Personalizado

Para implementaciones custom:

```tsx
import { useInstallPWA } from "@/hooks/use-install-pwa"

function CustomInstallButton() {
  const { isInstallable, isInstalled, installPWA } = useInstallPWA()
  
  if (isInstalled) {
    return <Badge>✓ Instalado</Badge>
  }
  
  if (!isInstallable) {
    return null
  }
  
  return (
    <Button onClick={installPWA} variant="premium">
      Instalar Aplicación
    </Button>
  )
}
```

---

## 🎨 Personalización

### Cambiar Posición del Banner

```tsx
// Banner en la esquina superior derecha
<InstallPWABanner className="top-20 bottom-auto" />

// Banner centrado en la parte inferior
<InstallPWABanner className="left-1/2 -translate-x-1/2 w-96" />

// Banner en pantalla completa móvil
<InstallPWABanner className="md:w-96 w-full" />
```

### Modificar Estilos

Edita `components/install-pwa.tsx`:

```tsx
// Cambiar gradiente
<Card className="... bg-gradient-to-r from-blue-500 to-cyan-600">

// Cambiar colores del botón
<Button className="bg-gradient-to-r from-green-500 to-emerald-600">

// Cambiar tamaño
<Card className="... md:w-[450px]">
```

### Personalizar Texto

```tsx
<h3>¡Descarga la App!</h3>
<p>Acceso rápido y funciona sin internet</p>
<Button>Descargar Ahora</Button>
```

---

## 🔧 API del Hook

### `useInstallPWA()`

Retorna un objeto con:

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `isInstallable` | `boolean` | `true` si la PWA puede instalarse |
| `isInstalled` | `boolean` | `true` si la PWA ya está instalada |
| `installPWA` | `() => Promise<boolean>` | Función para iniciar instalación |

### Ejemplo Completo

```tsx
function InstallStatus() {
  const { isInstallable, isInstalled, installPWA } = useInstallPWA()
  
  const handleInstall = async () => {
    const success = await installPWA()
    if (success) {
      toast.success("¡App instalada exitosamente!")
    } else {
      toast.error("Instalación cancelada")
    }
  }
  
  return (
    <div>
      <p>Estado: {isInstalled ? "Instalado" : "No instalado"}</p>
      <p>Instalable: {isInstallable ? "Sí" : "No"}</p>
      <Button onClick={handleInstall} disabled={!isInstallable}>
        Instalar
      </Button>
    </div>
  )
}
```

---

## 🎯 Ubicaciones Recomendadas

### ✅ Buenas Ubicaciones

- ✓ **Dashboard principal**: Banner flotante (actual)
- ✓ **Settings**: Botón en sección "Aplicación"
- ✓ **Navbar**: Botón pequeño junto al usuario
- ✓ **Página de inicio**: Banner prominente
- ✓ **Modal de bienvenida**: Para nuevos usuarios

### ❌ Ubicaciones a Evitar

- ✗ Formularios de login/registro (distrae)
- ✗ Procesos de checkout (interrumpe flujo)
- ✗ Modales críticos (puede confundir)
- ✗ Múltiples lugares a la vez (spam)

---

## 🌐 Compatibilidad

### ✅ Soportado

- Chrome (Android, Desktop, ChromeOS)
- Edge (Desktop, Android)
- Samsung Internet
- Firefox (Android - limitado)
- Opera (Desktop, Android)

### ⚠️ Limitado

- **Safari iOS**: No soporta API beforeinstallprompt
  - El componente no aparece
  - Usuarios deben usar "Agregar a Inicio" manual
  - Considera mostrar instrucciones para iOS

- **Firefox Desktop**: Soporte experimental
  - Requiere flag habilitado

### Detectar Safari iOS

```tsx
function IOSInstallInstructions() {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
  
  if (isIOS && !isInStandaloneMode) {
    return (
      <Alert>
        <p>Para instalar en iOS:</p>
        <ol>
          <li>Tap en <ShareIcon /> (Compartir)</li>
          <li>Selecciona "Agregar a Inicio"</li>
        </ol>
      </Alert>
    )
  }
  
  return null
}
```

---

## 🎭 Estados del Componente

### 1. No Mostrar
- PWA ya instalada
- No es instalable (ya instalado o no cumple requisitos)
- Usuario descartó el banner

### 2. Mostrar Banner
- PWA instalable
- No está instalado
- Usuario no lo ha descartado

### 3. Instalando
- Usuario hizo click en "Instalar"
- Sistema muestra diálogo nativo

### 4. Instalado
- Instalación exitosa
- Banner se oculta automáticamente
- Estado persiste

---

## 💾 Persistencia

El componente usa `localStorage` para recordar si el usuario descartó el banner:

```tsx
// Se guarda cuando el usuario hace click en "Ahora no" o "✕"
localStorage.setItem("pwa-install-dismissed", Date.now().toString())

// Para resetear (testing):
localStorage.removeItem("pwa-install-dismissed")
```

### Resetear después de X días

```tsx
const DAYS_TO_SHOW_AGAIN = 7

useEffect(() => {
  const dismissedTime = localStorage.getItem("pwa-install-dismissed")
  if (dismissedTime) {
    const daysPassed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24)
    if (daysPassed > DAYS_TO_SHOW_AGAIN) {
      localStorage.removeItem("pwa-install-dismissed")
    }
  }
}, [])
```

---

## 🧪 Testing

### Desarrollo Local

1. Build en modo producción:
```bash
pnpm build
pnpm start
```

2. Abre DevTools > Application > Manifest
3. Verifica que manifest.json se carga correctamente
4. Click en "Application" > Service Workers
5. El banner debe aparecer

### Testing en diferentes dispositivos

```bash
# Exponer servidor local a la red
pnpm start -- -H 0.0.0.0

# Accede desde tu móvil
http://TU_IP_LOCAL:3000
```

### Simular PWA instalada

```tsx
// Agregar al useEffect en use-install-pwa.ts
if (process.env.NODE_ENV === 'development') {
  // Forzar como instalado
  setIsInstalled(true)
  
  // O forzar como instalable
  setIsInstallable(true)
}
```

---

## 📊 Métricas Recomendadas

Trackea estas métricas para optimizar la instalación:

```tsx
// Cuando el banner se muestra
analytics.track('pwa_banner_shown')

// Cuando el usuario hace click en instalar
analytics.track('pwa_install_clicked')

// Cuando el usuario acepta
analytics.track('pwa_install_accepted')

// Cuando el usuario rechaza
analytics.track('pwa_install_rejected')

// Cuando el usuario descarta el banner
analytics.track('pwa_banner_dismissed')
```

### Ejemplo con Google Analytics

```tsx
const handleInstall = async () => {
  gtag('event', 'pwa_install_clicked')
  
  const success = await installPWA()
  
  if (success) {
    gtag('event', 'pwa_install_accepted')
  } else {
    gtag('event', 'pwa_install_rejected')
  }
}
```

---

## 🔍 Troubleshooting

### El banner no aparece

**Checklist:**
- [ ] ¿Estás en modo producción? (`pnpm build && pnpm start`)
- [ ] ¿La app es HTTPS? (localhost está OK)
- [ ] ¿El manifest.json se carga correctamente?
- [ ] ¿El Service Worker está registrado?
- [ ] ¿Ya está instalado? (check DevTools > Application)
- [ ] ¿Lo descartaste antes? (check localStorage)

### Forzar que aparezca

```tsx
// En use-install-pwa.ts, agrega después del useEffect:
if (process.env.NODE_ENV === 'development') {
  setIsInstallable(true)
}
```

### El evento beforeinstallprompt no se dispara

Requisitos PWA mínimos:
- ✓ Manifest.json válido
- ✓ Service Worker registrado
- ✓ Servido via HTTPS
- ✓ Íconos de tamaños correctos (192x192, 512x512)
- ✓ No está ya instalado

---

## 🎁 Ejemplos Adicionales

### Banner con Countdown

```tsx
const [showBanner, setShowBanner] = useState(false)

useEffect(() => {
  // Mostrar después de 30 segundos
  const timer = setTimeout(() => setShowBanner(true), 30000)
  return () => clearTimeout(timer)
}, [])

return showBanner ? <InstallPWABanner /> : null
```

### Banner con Scroll Trigger

```tsx
const [showBanner, setShowBanner] = useState(false)

useEffect(() => {
  const handleScroll = () => {
    if (window.scrollY > 500) {
      setShowBanner(true)
    }
  }
  
  window.addEventListener('scroll', handleScroll)
  return () => window.removeEventListener('scroll', handleScroll)
}, [])
```

### Banner con Animación

```tsx
<InstallPWABanner className="animate-in slide-in-from-bottom-5 duration-500" />
```

---

## 📚 Referencias

- [MDN - beforeinstallprompt](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent)
- [Web.dev - Customize Install](https://web.dev/customize-install/)
- [Chrome Developers - Install Prompt](https://developer.chrome.com/docs/web-platform/install-criteria)

---

**Última actualización:** Octubre 2025


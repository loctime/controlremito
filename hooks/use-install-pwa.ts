"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function useInstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Verificar si ya está instalado
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }

    // MODO DESARROLLO: Solo mostrar si hay un prompt real
    // No forzar isInstallable en desarrollo para evitar errores

    // Escuchar el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevenir que Chrome 67 y anteriores muestren el prompt automáticamente
      e.preventDefault()
      // Guardar el evento para usarlo después
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      setIsInstallable(true)
      console.log("✅ PWA instalable - Botón activado")
    }

    // Escuchar cuando la app fue instalada
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
      console.log("🎉 PWA instalada exitosamente")
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const installPWA = async () => {
    if (!deferredPrompt) {
      if (process.env.NODE_ENV === "development") {
        console.log("⚠️ No hay prompt de instalación disponible en desarrollo")
        console.log("📝 Para probar la instalación:")
        console.log("   1. Ejecuta: pnpm build")
        console.log("   2. Ejecuta: pnpm start")
        console.log("   3. Abre la app en Chrome/Edge")
        console.log("   4. El botón funcionará correctamente")
        alert("⚠️ Instalación PWA solo funciona en producción\n\nPara probar:\n1. pnpm build\n2. pnpm start\n3. Abre en Chrome/Edge")
      } else {
        console.log("❌ No hay prompt de instalación disponible")
      }
      return false
    }

    // Mostrar el prompt de instalación
    deferredPrompt.prompt()

    // Esperar a que el usuario responda
    const { outcome } = await deferredPrompt.userChoice
    
    console.log(`Usuario ${outcome === "accepted" ? "aceptó ✅" : "rechazó ❌"} la instalación`)

    // Limpiar el prompt usado
    setDeferredPrompt(null)
    setIsInstallable(false)

    return outcome === "accepted"
  }

  return {
    isInstallable,
    isInstalled,
    installPWA,
  }
}


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

    // Escuchar el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevenir que Chrome 67 y anteriores muestren el prompt automáticamente
      e.preventDefault()
      // Guardar el evento para usarlo después
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      setIsInstallable(true)
    }

    // Escuchar cuando la app fue instalada
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
      console.log("PWA instalada exitosamente")
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
      console.log("No hay prompt de instalación disponible")
      return false
    }

    // Mostrar el prompt de instalación
    deferredPrompt.prompt()

    // Esperar a que el usuario responda
    const { outcome } = await deferredPrompt.userChoice
    
    console.log(`Usuario ${outcome === "accepted" ? "aceptó" : "rechazó"} la instalación`)

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


"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { BranchDashboard } from "@/components/dashboard/branch-dashboard"
import { FactoryDeliveryDashboard } from "@/components/dashboard/factory-delivery-dashboard"
import { PullToRefresh } from "@/components/mobile/pull-to-refresh"

function DashboardContent() {
  const { user } = useAuth()

  const handleRefresh = async () => {
    // Forzar recarga de datos
    window.location.reload()
  }

  // Renderizar dashboard según el rol del usuario
  if (user?.role === "branch") {
    return (
      <ProtectedRoute>
        <PullToRefresh onRefresh={handleRefresh}>
          <BranchDashboard />
        </PullToRefresh>
      </ProtectedRoute>
    )
  }

  // Para factory y delivery
  return (
    <ProtectedRoute>
      <PullToRefresh onRefresh={handleRefresh}>
        <FactoryDeliveryDashboard />
      </PullToRefresh>
    </ProtectedRoute>
  )
}

export default DashboardContent

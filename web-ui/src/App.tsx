import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import BotEditPage from '@/pages/BotEditPage'
import BotLogsPage from '@/pages/BotLogsPage'
import BotAssetsPage from '@/pages/BotAssetsPage'
import BotCreateWizard from '@/pages/BotCreateWizard'
import HelpPage from '@/pages/HelpPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
  },
})

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Загрузка...
      </div>
    )
  }

  if (isError || !data) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/help" element={<AuthGuard><HelpPage /></AuthGuard>} />
      <Route path="/" element={<Navigate to="/bots" replace />} />
      <Route path="/bots" element={<AuthGuard><DashboardPage /></AuthGuard>} />
      <Route path="/bots/new" element={<AuthGuard><BotCreateWizard /></AuthGuard>} />
      <Route path="/bots/:id" element={<AuthGuard><BotEditPage /></AuthGuard>} />
      <Route path="/bots/:id/logs" element={<AuthGuard><BotLogsPage /></AuthGuard>} />
      <Route path="/bots/:id/assets" element={<AuthGuard><BotAssetsPage /></AuthGuard>} />
      <Route path="*" element={<Navigate to="/bots" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

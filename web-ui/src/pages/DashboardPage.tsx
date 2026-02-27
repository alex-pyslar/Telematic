import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { useLogout } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BotSnapshot, BotStatus, ImportResult } from '@/types'
import {
  Play, Square, RotateCcw, Plus, LogOut, Bot,
  FileText, ScrollText, Settings, Download, Upload,
  HelpCircle, ChevronDown, X, AlertCircle, CheckCircle2,
  Sun, Moon,
} from 'lucide-react'

function statusVariant(s: BotStatus) {
  switch (s) {
    case 'running': return 'success'
    case 'starting': return 'warning'
    case 'error': return 'destructive'
    default: return 'secondary'
  }
}

function statusLabel(s: BotStatus) {
  switch (s) {
    case 'running': return 'Работает'
    case 'starting': return 'Запускается'
    case 'error': return 'Ошибка'
    default: return 'Остановлен'
  }
}

function BotCard({ bot }: { bot: BotSnapshot }) {
  const qc = useQueryClient()
  const refetch = () => qc.invalidateQueries({ queryKey: ['bots'] })

  const start = useMutation({ mutationFn: () => api.bots.start(bot.id), onSuccess: refetch })
  const stop = useMutation({ mutationFn: () => api.bots.stop(bot.id), onSuccess: refetch })
  const restart = useMutation({ mutationFn: () => api.bots.restart(bot.id), onSuccess: refetch })

  const isRunning = bot.status === 'running' || bot.status === 'starting'
  const isLoading = start.isPending || stop.isPending || restart.isPending

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{bot.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{bot.id}</p>
          </div>
          <Badge variant={statusVariant(bot.status)} className="shrink-0">{statusLabel(bot.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 flex-1">
        {bot.status === 'error' && (
          <p className="text-xs text-destructive bg-destructive/10 rounded p-2 break-all">
            {bot.status_msg || 'Неизвестная ошибка'}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          {!isRunning ? (
            <Button size="sm" variant="default" onClick={() => start.mutate()} disabled={isLoading}>
              <Play className="h-3 w-3" /> Запустить
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => stop.mutate()} disabled={isLoading}>
              <Square className="h-3 w-3" /> Остановить
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => restart.mutate()} disabled={isLoading} title="Перезапустить">
            <RotateCcw className="h-3 w-3" />
          </Button>
          <div className="flex gap-1 ml-auto">
            <Button size="sm" variant="ghost" asChild title="Настройки">
              <Link to={`/bots/${bot.id}`}><Settings className="h-3 w-3" /></Link>
            </Button>
            <Button size="sm" variant="ghost" asChild title="Логи">
              <Link to={`/bots/${bot.id}/logs`}><ScrollText className="h-3 w-3" /></Link>
            </Button>
            <Button size="sm" variant="ghost" asChild title="Файлы">
              <Link to={`/bots/${bot.id}/assets`}><FileText className="h-3 w-3" /></Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ExportImportModal({ onClose }: { onClose: () => void }) {
  const importJsonRef = useRef<HTMLInputElement>(null)
  const importZipRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  const importJSON = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text()
      const data = JSON.parse(text)
      return api.importJSON(data)
    },
    onSuccess: (res) => { setResult(res); qc.invalidateQueries({ queryKey: ['bots'] }) },
    onError: (e: Error) => setError(e.message),
  })

  const importZIP = useMutation({
    mutationFn: (file: File) => api.importZIP(file),
    onSuccess: (res) => { setResult(res); qc.invalidateQueries({ queryKey: ['bots'] }) },
    onError: (e: Error) => setError(e.message),
  })

  const isLoading = importJSON.isPending || importZIP.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-card text-card-foreground rounded-t-2xl sm:rounded-xl shadow-lg w-full sm:max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Экспорт и импорт</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Экспорт</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild className="flex-1">
                <a href={api.exportURL('json')} download="bots_export.json">
                  <Download className="h-3 w-3 mr-1" /> JSON (конфиги)
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="flex-1">
                <a href={api.exportURL('zip')} download="bots_export.zip">
                  <Download className="h-3 w-3 mr-1" /> ZIP (с файлами)
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              JSON — только конфиги. ZIP — конфиги + все загруженные картинки и документы.
            </p>
          </div>
          <div className="border-t" />
          <div>
            <p className="text-sm font-medium mb-2">Импорт</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" disabled={isLoading}
                onClick={() => importJsonRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1" /> JSON
              </Button>
              <Button variant="outline" size="sm" className="flex-1" disabled={isLoading}
                onClick={() => importZipRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1" /> ZIP
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Совместим со старым bots.json. Боты добавятся с enabled: false.
            </p>
            <input ref={importJsonRef} type="file" accept=".json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { importJSON.mutate(f); e.target.value = '' } }} />
            <input ref={importZipRef} type="file" accept=".zip" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { importZIP.mutate(f); e.target.value = '' } }} />
          </div>
          {isLoading && <p className="text-sm text-muted-foreground text-center">Импортируем...</p>}
          {error && (
            <div className="flex gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {result && (
            <div className="space-y-2">
              {result.imported.length > 0 && (
                <div className="flex gap-2 text-sm text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400 rounded-lg p-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Импортировано: {result.imported.join(', ')}</span>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="flex gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{result.errors.map((e, i) => <p key={i}>{e}</p>)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const logout = useLogout()
  const { theme, toggle: toggleTheme } = useTheme()
  const [showExportImport, setShowExportImport] = useState(false)

  const { data: bots = [], isLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: api.bots.list,
    refetchInterval: 5000,
  })

  const sorted = [...bots].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  const running = bots.filter(b => b.status === 'running' || b.status === 'starting').length

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold whitespace-nowrap">Bot Manager</span>
            {bots.length > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {running}/{bots.length} работает
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" asChild title="Справка">
              <Link to="/help"><HelpCircle className="h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowExportImport(true)} className="hidden sm:flex">
              <ChevronDown className="h-3 w-3 mr-1" /> Экспорт/Импорт
            </Button>
            <Button asChild size="sm">
              <Link to="/bots/new"><Plus className="h-4 w-4" /><span className="hidden sm:inline ml-1">Новый бот</span></Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => logout.mutate()} disabled={logout.isPending} title="Выйти">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Mobile: second row for extra buttons */}
        <div className="sm:hidden flex items-center gap-2 px-3 pb-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowExportImport(true)}>
            <ChevronDown className="h-3 w-3 mr-1" /> Экспорт/Импорт
          </Button>
          {bots.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {running}/{bots.length} работает
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-16">Загрузка...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <Bot className="h-14 w-14 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Нет ботов. Создайте первого!</p>
            <Button asChild>
              <Link to="/bots/new"><Plus className="h-4 w-4 mr-1" />Создать бота</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map(bot => <BotCard key={bot.id} bot={bot} />)}
          </div>
        )}
      </main>

      {showExportImport && <ExportImportModal onClose={() => setShowExportImport(false)} />}
    </div>
  )
}

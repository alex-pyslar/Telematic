import { useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function BotLogsPage() {
  const { id } = useParams<{ id: string }>()
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: logs = [] } = useQuery({
    queryKey: ['bot-logs', id],
    queryFn: () => api.bots.logs(id!),
    refetchInterval: 3000,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b sticky top-0 z-10 bg-background">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/bots"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="font-semibold">Логи — {id}</h1>
          <span className="text-xs text-muted-foreground ml-auto">обновляется каждые 3 сек</span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
        <div className="bg-zinc-950 text-green-400 rounded-lg p-4 font-mono text-xs min-h-[500px] overflow-auto">
          {logs.length === 0 ? (
            <span className="text-zinc-500">Нет логов...</span>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all leading-5">{line}</div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </main>
    </div>
  )
}

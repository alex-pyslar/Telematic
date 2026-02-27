import { useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Asset } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Upload, Trash2, FileText, ExternalLink } from 'lucide-react'

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function AssetRow({ asset, botId }: { asset: Asset; botId: string }) {
  const qc = useQueryClient()

  const del = useMutation({
    mutationFn: () => api.assets.delete(botId, asset.minio_key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets', botId] }),
  })

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{asset.filename}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(asset.size)} · {asset.content_type}</p>
      </div>
      <div className="flex gap-1">
        {asset.url && (
          <Button variant="ghost" size="icon" asChild>
            <a href={asset.url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
          onClick={() => del.mutate()} disabled={del.isPending}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function BotAssetsPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', id],
    queryFn: () => api.assets.list(id!),
  })

  const upload = useMutation({
    mutationFn: (file: File) => api.assets.upload(id!, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets', id] }),
  })

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => upload.mutate(file))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-10 bg-background">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/bots"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="font-semibold">Файлы — {id}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Upload zone */}
        <Card>
          <CardHeader><CardTitle className="text-base">Загрузить файлы</CardTitle></CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Перетащите файлы сюда или нажмите для выбора</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX и другие</p>
              {upload.isPending && <p className="text-xs text-primary mt-2">Загрузка...</p>}
            </div>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          </CardContent>
        </Card>

        {/* File list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Файлы ({assets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка...</p>
            ) : assets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Нет файлов</p>
            ) : (
              assets.map(a => <AssetRow key={a.id} asset={a} botId={id!} />)
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Bot, Asset } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MdTextarea } from '@/components/ui/md-textarea'
import { ArrowLeft, Save, Trash2, Upload, FileText, ExternalLink, ScrollText, Play, Square } from 'lucide-react'

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function AssetRow({ asset, botId, onDeleted }: { asset: Asset; botId: string; onDeleted: (key: string) => void }) {
  const del = useMutation({
    mutationFn: () => api.assets.delete(botId, asset.minio_key),
    onSuccess: () => onDeleted(asset.minio_key),
  })

  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{asset.filename}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(asset.size)}</p>
      </div>
      <div className="flex gap-1">
        {asset.url && (
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a href={asset.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => del.mutate()} disabled={del.isPending}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

const defaultForm: Partial<Bot> = {
  name: '', token: '', channel_id: 0,
  invite_link: '', welcome_img_key: '',
  welcome_msg: '', button_text: 'Получить!',
  not_sub_msg: '', success_msg: '', enabled: false,
}

export default function BotEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const imgRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const { data: existing } = useQuery({
    queryKey: ['bot', id],
    queryFn: () => api.bots.get(id!),
    enabled: !!id,
  })

  const { data: assetsData } = useQuery({
    queryKey: ['assets', id],
    queryFn: () => api.assets.list(id!),
    enabled: !!id,
  })
  const [assets, setAssets] = useState<Asset[]>([])
  useEffect(() => { if (assetsData !== undefined) setAssets(assetsData) }, [assetsData])

  const [form, setForm] = useState<Partial<Bot>>(defaultForm)
  const [welcomePreview, setWelcomePreview] = useState('')

  useEffect(() => {
    if (existing) {
      setForm(existing)
      if (existing.welcome_img_url) setWelcomePreview(existing.welcome_img_url)
    }
  }, [existing, id])

  const set = (field: keyof Bot) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const update = useMutation({
    mutationFn: (data: Partial<Bot>) => api.bots.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots'] })
      qc.invalidateQueries({ queryKey: ['bot', id] })
    },
  })

  const del = useMutation({
    mutationFn: () => api.bots.delete(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bots'] }); navigate('/bots') },
  })

  const uploadWelcome = useMutation({
    mutationFn: (file: File) => api.assets.uploadWelcome(id!, file),
    onSuccess: (res) => {
      setForm(f => ({ ...f, welcome_img_key: res.key }))
      setWelcomePreview(res.url)
    },
  })

  const uploadDoc = useMutation({
    mutationFn: (file: File) => api.assets.upload(id!, file),
    onSuccess: (asset) => setAssets(prev => [...prev, asset]),
  })

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(f => uploadDoc.mutate(f))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    update.mutate(form)
  }

  const start = useMutation({
    mutationFn: () => api.bots.start(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bots'] }),
  })
  const stop = useMutation({
    mutationFn: () => api.bots.stop(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bots'] }),
  })

  const isPending = update.isPending

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/bots"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="font-semibold flex-1 truncate text-sm sm:text-base">
            {form.name || 'Редактирование бота'}
          </h1>
          <div className="flex gap-1 sm:gap-2 shrink-0">
            <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
              <Link to={`/bots/${id}/logs`}><ScrollText className="h-4 w-4 mr-1" />Логи</Link>
            </Button>
            <Button variant="ghost" size="icon" asChild className="sm:hidden">
              <Link to={`/bots/${id}/logs`}><ScrollText className="h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
              <Play className="h-3 w-3" /><span className="hidden sm:inline ml-1">Запустить</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => stop.mutate()} disabled={stop.isPending}>
              <Square className="h-3 w-3" /><span className="hidden sm:inline ml-1">Стоп</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* --- Basic --- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Основное</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ID бота</Label>
                  <Input value={id ?? ''} disabled className="font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Название *</Label>
                  <Input value={form.name ?? ''} onChange={set('name')} placeholder="Мой бот" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Telegram Token *</Label>
                <Input value={form.token ?? ''} onChange={set('token')} placeholder="123456:ABC..." required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel ID *</Label>
                  <Input
                    type="number"
                    value={form.channel_id ?? ''}
                    onChange={e => setForm(f => ({ ...f, channel_id: Number(e.target.value) }))}
                    placeholder="-1001234567890"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Invite Link</Label>
                  <Input value={form.invite_link ?? ''} onChange={set('invite_link')} placeholder="https://t.me/+..." />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.enabled ?? false}
                  onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))}
                />
                <Label>Автозапуск при старте сервера</Label>
              </div>
            </CardContent>
          </Card>

          {/* --- Messages --- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Сообщения</CardTitle>
              <CardDescription>
                Вставьте обычный Markdown и нажмите <strong>MD → TG</strong> для авто-конвертации в Telegram MarkdownV2.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Приветственное сообщение</Label>
                <MdTextarea
                  value={form.welcome_msg ?? ''}
                  onChange={set('welcome_msg')}
                  rows={5}
                  placeholder={'Привет 👋\n\nОписание материала. Подпишись на канал ➡️ @channel 👇'}
                />
              </div>
              <div className="space-y-2">
                <Label>Текст кнопки</Label>
                <Input value={form.button_text ?? ''} onChange={set('button_text')} placeholder="Получить!" />
              </div>
              <div className="space-y-2">
                <Label>Сообщение «не подписан»</Label>
                <MdTextarea
                  value={form.not_sub_msg ?? ''}
                  onChange={set('not_sub_msg')}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Сообщение после подписки / ссылки</Label>
                <MdTextarea
                  value={form.success_msg ?? ''}
                  onChange={set('success_msg')}
                  rows={4}
                  placeholder={'**Отлично!** 🔥\n\n👉 [Открыть материал](https://example.com)'}
                />
                <p className="text-xs text-muted-foreground">
                  Если есть загруженные файлы — это сообщение отправится перед ними.
                  Если файлов нет — только этот текст со ссылками.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* --- Welcome image --- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Welcome-картинка</CardTitle>
              <CardDescription>Изображение, которое бот отправляет при /start</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-center flex-wrap">
                {welcomePreview ? (
                  <img src={welcomePreview} alt="welcome" className="h-24 w-24 rounded-lg object-cover border" />
                ) : form.welcome_img_key ? (
                  <div className="h-24 w-24 rounded-lg border bg-muted flex items-center justify-center text-xs text-muted-foreground text-center p-2">
                    Загружено
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center text-xs text-muted-foreground text-center p-2">
                    Нет фото
                  </div>
                )}
                <div className="space-y-1">
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => imgRef.current?.click()} disabled={uploadWelcome.isPending}>
                    <Upload className="h-3 w-3 mr-1" />
                    {uploadWelcome.isPending ? 'Загрузка...' : 'Загрузить / заменить'}
                  </Button>
                  <p className="text-xs text-muted-foreground">JPG или PNG, до 16 МБ</p>
                  {form.welcome_img_key && (
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">{form.welcome_img_key}</p>
                  )}
                  <input ref={imgRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadWelcome.mutate(f) }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* --- Documents --- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Файлы для раздачи</CardTitle>
              <CardDescription>
                Если загружены — бот отправит их подписавшимся (перед ними или вместо текста).
                Если файлов нет — только текст «после подписки» выше.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
                onClick={() => docRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
              >
                <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-sm text-muted-foreground">Перетащите файлы или нажмите</p>
                <p className="text-xs text-muted-foreground">PDF, DOC, DOCX и другие</p>
                {uploadDoc.isPending && <p className="text-xs text-primary mt-1">Загрузка...</p>}
              </div>
              <input ref={docRef} type="file" multiple className="hidden"
                onChange={e => handleFiles(e.target.files)} />

              {assets.length > 0 ? (
                <div className="rounded-lg border divide-y">
                  {assets.map(a => (
                    <AssetRow
                      key={a.id}
                      asset={a}
                      botId={id!}
                      onDeleted={key => setAssets(prev => prev.filter(x => x.minio_key !== key))}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Нет загруженных файлов</p>
              )}
            </CardContent>
          </Card>

          {/* --- Actions --- */}
          <div className="flex gap-3 justify-between">
            <Button type="button" variant="destructive" onClick={() => {
              if (confirm('Удалить бота? Это действие нельзя отменить.')) del.mutate()
            }} disabled={del.isPending}>
              <Trash2 className="h-4 w-4 mr-1" /> Удалить бота
            </Button>
            <Button type="submit" disabled={isPending} className="min-w-28 sm:min-w-32">
              <Save className="h-4 w-4 mr-1" /> {isPending ? 'Сохраняем...' : 'Сохранить'}
            </Button>
          </div>

          {update.isSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400 text-center">Сохранено!</p>
          )}
          {update.isError && (
            <p className="text-sm text-destructive text-center">
              {(update.error as Error).message}
            </p>
          )}
        </form>
      </main>
    </div>
  )
}

import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Bot } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MdTextarea } from '@/components/ui/md-textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, ArrowRight, Check, Upload, FileText, Trash2, Info } from 'lucide-react'

// --- helpers ---

const translitMap: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',
  й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',
  у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',
  ь:'',э:'e',ю:'yu',я:'ya',
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/./g, (c) => translitMap[c] ?? c)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

// --- steps indicator ---

function Steps({ current }: { current: number }) {
  const steps = ['Основное', 'Сообщения', 'Медиа и файлы']
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={idx} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                done ? 'bg-primary text-primary-foreground' :
                active ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                'bg-muted text-muted-foreground'
              }`}>
                {done ? <Check className="h-4 w-4" /> : idx}
              </div>
              <span className={`text-xs whitespace-nowrap ${active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-5 ${done ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// --- step 1: basic info ---

interface Step1Data {
  name: string
  id: string
  token: string
  channel_id: string
  invite_link: string
}

function Step1({ onNext }: { onNext: (d: Step1Data) => void }) {
  const [form, setForm] = useState<Step1Data>({ name: '', id: '', token: '', channel_id: '', invite_link: '' })
  const [idTouched, setIdTouched] = useState(false)

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setForm(f => ({ ...f, name: val, id: idTouched ? f.id : slugify(val) }))
  }

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIdTouched(true)
    setForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))
  }

  const set = (field: keyof Step1Data) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const valid = form.name && form.id && form.token && form.channel_id

  return (
    <form onSubmit={e => { e.preventDefault(); if (valid) onNext(form) }}>
      <Card>
        <CardHeader>
          <CardTitle>Основные настройки</CardTitle>
          <CardDescription>Введите базовые параметры бота</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Название бота *</Label>
              <Input value={form.name} onChange={handleNameChange} placeholder="Мой образовательный бот" required />
            </div>
            <div className="space-y-2">
              <Label>ID бота *</Label>
              <Input value={form.id} onChange={handleIdChange} placeholder="my-bot" pattern="[a-z0-9-]+" required />
              <p className="text-xs text-muted-foreground">Только латиница, цифры, дефис</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Telegram Token *</Label>
            <Input value={form.token} onChange={set('token')} placeholder="123456789:AAH4BKk8..." required />
            <p className="text-xs text-muted-foreground">
              Получить у{' '}
              <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary underline">@BotFather</a>
              {' '}командой /newbot
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Channel ID *</Label>
              <Input value={form.channel_id} onChange={set('channel_id')} placeholder="-1001234567890" required />
              <p className="text-xs text-muted-foreground">ID канала для проверки подписки</p>
            </div>
            <div className="space-y-2">
              <Label>Invite Link (если приватный)</Label>
              <Input value={form.invite_link} onChange={set('invite_link')} placeholder="https://t.me/+..." />
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground flex gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Бот должен быть добавлен администратором в канал (права: просмотр участников). Без этого проверка подписки не работает.</span>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end mt-4">
        <Button type="submit" disabled={!valid}>
          Далее <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </form>
  )
}

// --- step 2: messages ---

interface Step2Data {
  welcome_msg: string
  button_text: string
  not_sub_msg: string
  success_msg: string
}

function Step2({ onBack, onNext, loading }: { onBack: () => void; onNext: (d: Step2Data) => void; loading: boolean }) {
  const [form, setForm] = useState<Step2Data>({
    welcome_msg: '', button_text: 'Получить!', not_sub_msg: '', success_msg: '',
  })

  const setF = (field: keyof Step2Data) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <form onSubmit={e => { e.preventDefault(); onNext(form) }}>
      <Card>
        <CardHeader>
          <CardTitle>Сообщения бота</CardTitle>
          <CardDescription>
            Вставьте обычный Markdown и нажмите <strong>MD → TG</strong> — сервис автоматически конвертирует его в формат Telegram MarkdownV2.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Приветственное сообщение *</Label>
            <MdTextarea
              value={form.welcome_msg}
              onChange={setF('welcome_msg')}
              rows={5}
              placeholder={'Привет 👋\n\nЗдесь описание материала. Подпишись на канал ➡️ @channel и жми кнопку 👇'}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Текст кнопки *</Label>
            <Input value={form.button_text} onChange={setF('button_text')} placeholder="Получить материал!" required />
          </div>

          <div className="space-y-2">
            <Label>Сообщение при отсутствии подписки *</Label>
            <MdTextarea
              value={form.not_sub_msg}
              onChange={setF('not_sub_msg')}
              rows={3}
              placeholder="Чтобы получить материал, сначала подпишитесь на канал 👉 @channel"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Сообщение после подписки / ссылки</Label>
            <MdTextarea
              value={form.success_msg}
              onChange={setF('success_msg')}
              rows={4}
              placeholder={'**Отлично!** 🔥 Держи материал:\n\n👉 [Открыть](https://example.com)'}
            />
            <p className="text-xs text-muted-foreground">
              Если на следующем шаге загрузите файлы — это сообщение будет перед ними.
              Если файлов нет — бот отправит только этот текст.
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground flex gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Бот автоматически определяет: есть ли загруженные файлы. Если есть — отправляет их. Если нет — отправляет текст выше.
              Отдельно выбирать «тип» бота больше не нужно.
            </span>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between mt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Назад
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Создаём...' : <><Check className="h-4 w-4 mr-1" /> Создать бота</>}
        </Button>
      </div>
    </form>
  )
}

// --- step 3: media & files ---

function Step3({ botId, onDone }: { botId: string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [welcomePreview, setWelcomePreview] = useState('')
  const [assets, setAssets] = useState<import('@/types').Asset[]>([])

  const uploadDoc = useMutation({
    mutationFn: (file: File) => api.assets.upload(botId, file),
    onSuccess: (asset) => setAssets(prev => [...prev, asset]),
  })

  const deleteDoc = useMutation({
    mutationFn: (key: string) => api.assets.delete(botId, key),
    onSuccess: (_, key) => setAssets(prev => prev.filter(a => a.minio_key !== key)),
  })

  const uploadWelcome = useMutation({
    mutationFn: (file: File) => api.assets.uploadWelcome(botId, file),
    onSuccess: (res) => setWelcomePreview(res.url),
  })

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(f => uploadDoc.mutate(f))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Welcome-картинка</CardTitle>
          <CardDescription>Изображение, которое бот отправляет при /start вместе с приветствием</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center flex-wrap">
            {welcomePreview ? (
              <img src={welcomePreview} alt="welcome" className="h-24 w-24 rounded-lg object-cover border" />
            ) : (
              <div className="h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center text-xs text-muted-foreground text-center p-2">
                Нет фото
              </div>
            )}
            <div className="space-y-1">
              <Button type="button" variant="outline" size="sm"
                onClick={() => imgRef.current?.click()} disabled={uploadWelcome.isPending}>
                <Upload className="h-3 w-3 mr-1" />
                {uploadWelcome.isPending ? 'Загрузка...' : 'Загрузить фото'}
              </Button>
              <p className="text-xs text-muted-foreground">JPG или PNG, до 16 МБ</p>
              <input ref={imgRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadWelcome.mutate(f) }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Файлы для раздачи (необязательно)</CardTitle>
          <CardDescription>
            Загрузите PDF, DOC и другие файлы. Если есть файлы — бот отправит их подписавшимся. Если нет — только текст.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
          >
            <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
            <p className="text-sm text-muted-foreground">Перетащите файлы или нажмите</p>
            {uploadDoc.isPending && <p className="text-xs text-primary mt-1">Загрузка...</p>}
          </div>
          <input ref={fileRef} type="file" multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} />

          {assets.length > 0 && (
            <div className="divide-y rounded-lg border">
              {assets.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{a.filename}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(a.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon"
                    className="text-destructive hover:text-destructive h-7 w-7"
                    onClick={() => deleteDoc.mutate(a.minio_key)} disabled={deleteDoc.isPending}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Этот шаг можно пропустить — настроить позже</p>
        <Button onClick={onDone}>
          <Check className="h-4 w-4 mr-1" /> Готово!
        </Button>
      </div>
    </div>
  )
}

// --- main wizard component ---

export default function BotCreateWizard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [step, setStep] = useState(1)
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: (bot: Partial<Bot>) => api.bots.create(bot),
    onSuccess: (bot) => {
      qc.invalidateQueries({ queryKey: ['bots'] })
      setCreatedId(bot.id)
      setStep(3)
    },
  })

  const handleStep2 = (data: Step2Data) => {
    if (!step1Data) return
    create.mutate({
      id: step1Data.id,
      name: step1Data.name,
      type: 'bot',
      token: step1Data.token,
      channel_id: Number(step1Data.channel_id),
      invite_link: step1Data.invite_link,
      welcome_msg: data.welcome_msg,
      button_text: data.button_text,
      not_sub_msg: data.not_sub_msg,
      success_msg: data.success_msg,
      enabled: false,
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/bots"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="font-semibold">Новый бот</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-8">
        <Steps current={step} />

        {step === 1 && <Step1 onNext={d => { setStep1Data(d); setStep(2) }} />}
        {step === 2 && (
          <Step2 onBack={() => setStep(1)} onNext={handleStep2} loading={create.isPending} />
        )}
        {step === 3 && createdId && (
          <Step3 botId={createdId} onDone={() => navigate(`/bots/${createdId}`)} />
        )}

        {create.isError && (
          <p className="text-sm text-destructive mt-3 text-center">
            {(create.error as Error).message}
          </p>
        )}
      </main>
    </div>
  )
}

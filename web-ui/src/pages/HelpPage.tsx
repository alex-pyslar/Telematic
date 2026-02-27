import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, ExternalLink, Bot, MessageSquare, FileText, Image, CheckCircle2 } from 'lucide-react'

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
        {n}
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  )
}

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-10 bg-background">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/bots"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="font-semibold">Справка</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Overview */}
        <Section title="Как работает бот" icon={<Bot className="h-4 w-4" />}>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Каждый бот работает по одной схеме:</p>
            <ol className="space-y-1.5 list-none">
              <Step n={1}>Пользователь пишет боту <code className="bg-muted px-1 rounded">/start</code></Step>
              <Step n={2}>Бот отправляет <strong>приветственное сообщение</strong> (с картинкой или без) и кнопку</Step>
              <Step n={3}>Пользователь нажимает кнопку — бот проверяет подписку на канал</Step>
              <Step n={4}>
                <span>Если подписан:</span>
                <ul className="mt-1 ml-2 space-y-1">
                  <li>— Если у бота загружены файлы → отправляет <em>сообщение после подписки</em>, затем каждый файл</li>
                  <li>— Если файлов нет → отправляет только <em>сообщение после подписки</em> (там могут быть ссылки)</li>
                </ul>
              </Step>
              <Step n={5}>Если не подписан — отправляет <em>сообщение «не подписан»</em> с кнопкой снова</Step>
            </ol>
            <div className="rounded-lg bg-muted/50 p-3 mt-2">
              <strong>Важно:</strong> бот должен быть добавлен в канал как <strong>администратор</strong> с правом
              «Управление участниками» (или хотя бы «Просмотр участников»). Без этого проверка подписки не работает.
            </div>
          </div>
        </Section>

        {/* Create bot in BotFather */}
        <Section title="Как создать бота в Telegram" icon={<CheckCircle2 className="h-4 w-4" />}>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="space-y-2">
              <Step n={1}>
                Откройте Telegram и напишите{' '}
                <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                  @BotFather <ExternalLink className="h-3 w-3" />
                </a>
              </Step>
              <Step n={2}>
                Отправьте команду <code className="bg-muted px-1 rounded">/newbot</code>
              </Step>
              <Step n={3}>
                Введите <strong>название бота</strong> (любое, видно пользователям, например: «Мой образовательный бот»)
              </Step>
              <Step n={4}>
                Введите <strong>username бота</strong> — должен заканчиваться на <code className="bg-muted px-1 rounded">_bot</code>,
                например: <code className="bg-muted px-1 rounded">my_channel_bot</code>
              </Step>
              <Step n={5}>
                BotFather выдаст <strong>токен</strong> вида <code className="bg-muted px-1 rounded">1234567890:AAH...</code> — скопируйте его
              </Step>
              <Step n={6}>
                Добавьте бота в ваш канал как <strong>администратора</strong>:
                Настройки канала → Администраторы → Добавить администратора → найдите username бота
              </Step>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-blue-700 dark:text-blue-400">
              <strong>Узнать Channel ID</strong>: перешлите любое сообщение из канала боту{' '}
              <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">
                @userinfobot <ExternalLink className="h-3 w-3" />
              </a>
              {' '}или{' '}
              <a href="https://t.me/RawDataBot" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">
                @RawDataBot <ExternalLink className="h-3 w-3" />
              </a>. ID канала обычно начинается с <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">-100</code>.
            </div>
          </div>
        </Section>

        {/* Messages format */}
        <Section title="Формат сообщений (MarkdownV2)" icon={<MessageSquare className="h-4 w-4" />}>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-blue-700 dark:text-blue-400">
              <strong>Совет:</strong> в полях сообщений есть кнопка <strong>MD → TG</strong>.
              Вставьте обычный Markdown (как в Notion, GitHub и т.д.) и нажмите её —
              текст автоматически конвертируется в правильный формат Telegram MarkdownV2.
            </div>
            <p>Сообщения используют формат <strong>MarkdownV2 Telegram</strong>. Основные правила:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 pr-4 text-foreground">Эффект</th>
                    <th className="text-left py-1.5 pr-4 text-foreground">Синтаксис</th>
                    <th className="text-left py-1.5 text-foreground">Результат</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr><td className="py-1.5 pr-4">Жирный</td><td className="pr-4"><code className="bg-muted px-1 rounded">*текст*</code></td><td><strong>текст</strong></td></tr>
                  <tr><td className="py-1.5 pr-4">Курсив</td><td className="pr-4"><code className="bg-muted px-1 rounded">_текст_</code></td><td><em>текст</em></td></tr>
                  <tr><td className="py-1.5 pr-4">Ссылка</td><td className="pr-4"><code className="bg-muted px-1 rounded">[текст](https://url)</code></td><td className="text-primary underline">текст</td></tr>
                  <tr><td className="py-1.5 pr-4">Упоминание</td><td className="pr-4"><code className="bg-muted px-1 rounded">@username</code></td><td className="text-primary">@username</td></tr>
                </tbody>
              </table>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-amber-700 dark:text-amber-400">
              <strong>Обязательно экранируйте</strong> спецсимволы обратным слешем:
              <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded ml-1">! . ( ) - + = | [ ] {'{'} {'}'} # &gt;</code>
              <br />
              Например: <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">Привет\!</code> или <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">пункт 1\.</code>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Пример приветственного сообщения:</p>
              <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap">{`*Привет\\!* 👋

Я подготовил для тебя полезный материал\\. Чтобы забрать \\— подпишись на канал ➡️ @yourchannel

После подписки жми на кнопку 👇`}</pre>
            </div>
          </div>
        </Section>

        {/* Files */}
        <Section title="Файлы и картинки" icon={<FileText className="h-4 w-4" />}>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Image className="h-4 w-4 shrink-0 mt-0.5 text-foreground" />
                <div>
                  <strong className="text-foreground">Welcome-картинка</strong> — отправляется при <code className="bg-muted px-1 rounded">/start</code> вместе
                  с приветственным сообщением (как подпись к фото). Форматы: JPG, PNG. До 16 МБ.
                </div>
              </div>
              <div className="flex gap-2">
                <FileText className="h-4 w-4 shrink-0 mt-0.5 text-foreground" />
                <div>
                  <strong className="text-foreground">Файлы для раздачи</strong> — документы (PDF, DOCX и любые другие),
                  которые бот отправит подписавшимся. Загружайте сколько угодно файлов.
                  Если файлов нет — бот отправит только <em>сообщение после подписки</em> (удобно для ссылок на видео, курсы и т.д.).
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Export/Import */}
        <Section title="Экспорт и импорт" icon={<FileText className="h-4 w-4" />}>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Кнопка <strong>Экспорт/Импорт</strong> на главной странице позволяет:</p>
            <ul className="space-y-1 ml-2">
              <li><strong>JSON</strong> — экспортировать только конфиги ботов (без файлов). Удобно для переноса настроек.</li>
              <li><strong>ZIP</strong> — экспортировать всё: конфиги + все загруженные картинки и документы.</li>
              <li><strong>Импорт JSON/ZIP</strong> — загрузить ботов из файла. Совместим со старым форматом <code className="bg-muted px-1 rounded">bots.json</code>.</li>
            </ul>
            <div className="rounded-lg bg-muted/50 p-3">
              При импорте боты добавляются с <code className="bg-muted px-1 rounded">enabled: false</code> — их нужно запустить вручную после проверки.
            </div>
          </div>
        </Section>

        {/* Lifecycle */}
        <Section title="Управление ботами" icon={<Bot className="h-4 w-4" />}>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>На карточке каждого бота есть кнопки:</p>
            <ul className="space-y-1.5 ml-2">
              <li><strong>Запустить</strong> — запустить бота (он начнёт принимать сообщения)</li>
              <li><strong>Остановить</strong> — остановить бота</li>
              <li><strong>↺</strong> — перезапустить (полезно после изменения настроек)</li>
              <li><strong>⚙</strong> — открыть настройки бота (токен, тексты, файлы)</li>
              <li><strong>≡</strong> — открыть логи (последние 200 строк)</li>
              <li><strong>📄</strong> — управлять файлами бота</li>
            </ul>
            <div className="rounded-lg bg-muted/50 p-3">
              <strong>Автозапуск</strong>: в настройках бота есть переключатель «Автозапуск при старте сервера».
              Включите его, чтобы бот стартовал автоматически после перезагрузки сервера.
            </div>
          </div>
        </Section>

      </main>
    </div>
  )
}

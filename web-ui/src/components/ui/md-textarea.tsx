import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { mdToTelegramV2 } from '@/lib/markdown'
import { Wand2, Check } from 'lucide-react'

interface MdTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  rows?: number
}

/**
 * Textarea with a one-click "MD → Telegram" convert button.
 * The user can paste plain Markdown and click the wand to auto-convert
 * it to the Telegram MarkdownV2 format that the bot API expects.
 */
export function MdTextarea({ value, onChange, rows = 4, ...props }: MdTextareaProps) {
  const [converted, setConverted] = useState(false)

  const handleConvert = () => {
    const converted = mdToTelegramV2(value)
    // Synthesise a change event so parent state updates normally
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set
    const el = document.createElement('textarea')
    nativeInputValueSetter?.call(el, converted)
    const event = new Event('input', { bubbles: true })
    Object.defineProperty(event, 'target', { writable: false, value: el })
    onChange({ target: el } as unknown as React.ChangeEvent<HTMLTextAreaElement>)

    setConverted(true)
    setTimeout(() => setConverted(false), 2000)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Telegram MarkdownV2 или обычный Markdown (нажмите{' '}
          <span className="font-medium text-foreground">MD → TG</span> для конвертации)
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs shrink-0"
          onClick={handleConvert}
          disabled={!value}
          title="Конвертировать из обычного Markdown в Telegram MarkdownV2"
        >
          {converted ? (
            <><Check className="h-3 w-3 mr-1 text-green-600" />Готово!</>
          ) : (
            <><Wand2 className="h-3 w-3 mr-1" />MD → TG</>
          )}
        </Button>
      </div>
      <Textarea value={value} onChange={onChange} rows={rows} {...props} />
    </div>
  )
}

// BotType is kept for backward compatibility with existing DB records.
// All bots now use unified logic: files if assets exist, text otherwise.
export type BotType = string

export type BotStatus = 'stopped' | 'starting' | 'running' | 'error'

export interface Bot {
  id: string
  name: string
  type: BotType
  token: string
  channel_id: number
  invite_link: string
  welcome_img_key: string
  welcome_img_url?: string // presigned URL returned by GET /api/bots/{id}
  welcome_msg: string
  button_text: string
  not_sub_msg: string
  success_msg: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface BotSnapshot {
  id: string
  name: string
  type: BotType
  status: BotStatus
  status_msg: string
  enabled: boolean
}

export interface Asset {
  id: number
  bot_id: string
  minio_key: string
  filename: string
  content_type: string
  size: number
  created_at: string
  url: string
}

export interface ImportResult {
  imported: string[]
  errors: string[]
}

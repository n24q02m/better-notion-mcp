export interface NotionBlock {
  object: 'block'
  type: string
  [key: string]: any
}
export interface RichText {
  type: 'text' | 'mention'
  text: {
    content: string
    link?: { url: string } | null
  }
  mention?: {
    page?: { id: string }
    database?: { id: string }
    [key: string]: any
  }
  annotations: {
    bold: boolean
    italic: boolean
    strikethrough: boolean
    underline: boolean
    code: boolean
    color: string
  }
  plain_text?: string
  href?: string | null
}

/**
 * Convert standard Markdown to Telegram MarkdownV2 format.
 *
 * Supported conversions:
 *   **bold**        →  *bold*
 *   ***bold+ital*** →  *_bold italic_*
 *   *italic*        →  _italic_
 *   _italic_        →  _italic_
 *   ~~strike~~      →  ~strike~
 *   [text](url)     →  [text](url)
 *   `code`          →  `code`
 *   ```block```     →  ```block```
 *
 * All other special characters are escaped with backslash as required
 * by Telegram MarkdownV2 spec.
 */

// Characters that MUST be escaped in plain text segments
const PLAIN_ESCAPE_RE = /([_*[\]()~`>#+=|{}.!\-\\])/g

function escPlain(text: string): string {
  return text.replace(PLAIN_ESCAPE_RE, '\\$1')
}

function escLinkUrl(url: string): string {
  // Inside the () of a link, only ) needs to be escaped
  return url.replace(/\)/g, '\\)')
}

/**
 * Convert Markdown text to Telegram MarkdownV2.
 */
export function mdToTelegramV2(input: string): string {
  // Allow \n as newline shorthand (common in copy-pasted messages)
  input = input.replace(/\\n/g, '\n')

  // Pattern order matters — more specific patterns first:
  // 1. Fenced code blocks  ```…```
  // 2. Inline code  `…`
  // 3. Bold+italic  ***…***
  // 4. Bold         **…**
  // 5. Strikethrough ~~…~~
  // 6. Italic via * (not adjacent to another *)
  // 7. Italic via _ (not adjacent to another _)
  // 8. Link  [text](url)
  const pattern =
    /(```[\s\S]*?```)|(`[^`\n]+`)|\*{3}(.+?)\*{3}|\*{2}(.+?)\*{2}|~~(.+?)~~|\*([^*\n]+?)\*|(?<![_\w])_([^_\n]+?)_(?![_\w])|\[([^\]]*)\]\(([^)]*)\)/g

  let result = ''
  let lastIndex = 0

  for (const match of input.matchAll(pattern)) {
    const idx = match.index!

    // Escape the plain-text segment before this match
    result += escPlain(input.slice(lastIndex, idx))

    const [
      full,
      codeBlock,   // group 1
      inlineCode,  // group 2
      boldItalic,  // group 3  ***…***
      bold,        // group 4  **…**
      strike,      // group 5  ~~…~~
      italic1,     // group 6  *…*
      italic2,     // group 7  _…_
      linkText,    // group 8  [text]
      linkUrl,     // group 9  (url)
    ] = match

    if (codeBlock) {
      result += codeBlock                          // keep as-is
    } else if (inlineCode) {
      result += inlineCode                         // keep as-is
    } else if (boldItalic) {
      result += `*_${escPlain(boldItalic)}_*`
    } else if (bold) {
      result += `*${escPlain(bold)}*`
    } else if (strike) {
      result += `~${escPlain(strike)}~`
    } else if (italic1) {
      result += `_${escPlain(italic1)}_`
    } else if (italic2) {
      result += `_${escPlain(italic2)}_`
    } else if (linkText !== undefined && linkUrl !== undefined) {
      result += `[${escPlain(linkText)}](${escLinkUrl(linkUrl)})`
    }

    lastIndex = idx + full.length
  }

  // Escape the remaining plain-text tail
  result += escPlain(input.slice(lastIndex))

  return result
}

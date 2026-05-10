/**
 * 网页抓取模块 - 调试版
 */

import iconv from 'iconv-lite'
import { supabaseAdmin } from './supabase'

export interface PolicyItem {
  title: string
  url: string
  date: string
}

export interface ScrapeResult {
  policies: PolicyItem[]
  debug: {
    htmlLength: number
    htmlSnippet: string
    encoding: string
    matchedBy: string
  }
}

/**
 * 获取网页原始 HTML
 */
async function fetchHtml(url: string): Promise<{ html: string; encoding: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.mofcom.gov.cn/',
      'Connection': 'keep-alive',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') || ''
  let encoding = 'utf-8'

  if (contentType.includes('gbk') || contentType.includes('gb2312')) {
    encoding = 'gbk'
  } else {
    const headerStr = buffer.slice(0, 1024).toString('binary')
    if (/charset\s*=\s*["']?gbk/i.test(headerStr) ||
        /charset\s*=\s*["']?gb2312/i.test(headerStr)) {
      encoding = 'gbk'
    }
  }

  const html = iconv.decode(buffer, encoding)
  return { html, encoding }
}

/**
 * 清理 HTML 标签
 */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 判断标题是否像政策公告
 */
function isPolicyTitle(title: string): boolean {
  if (title.length < 10 || title.length > 200) return false
  const keywords = ['通知', '公告', '规定', '办法', '细则', '决定', '批复',
    '函', '通报', '意见', '通告', '令', '目录', '清单', '调整', '措施']
  return keywords.some(k => title.includes(k))
}

/**
 * 提取标题中的日期 [YYYY-MM-DD]
 */
function extractDate(title: string): { cleanTitle: string; date: string } {
  const match = title.match(/\[(\d{4}-\d{2}-\d{2})\]\s*$/)
  if (match) {
    return {
      cleanTitle: title.replace(/\s*\[\d{4}-\d{2}-\d{2}\]\s*$/, '').trim(),
      date: match[1],
    }
  }
  return { cleanTitle: title, date: new Date().toISOString().split('T')[0] }
}

/**
 * 生成唯一ID
 */
function generateId(title: string): string {
  return title.replace(/\s+/g, '').slice(0, 50)
}

/**
 * 主抓取函数 - 返回政策和调试信息
 */
export async function scrapeMoFomPolicies(): Promise<ScrapeResult> {
  const targetUrl = process.env.MOFCOM_URL || 'https://www.mofcom.gov.cn/zwgk/zcfb/index.html'

  try {
    const { html, encoding } = await fetchHtml(targetUrl)
    const policies: PolicyItem[] = []
    let matchedBy = 'none'

    // 策略1: 匹配包含 [YYYY-MM-DD] 的整行文本（最可能匹配商务部格式）
    // 模式：任意字符(包含中文) + [YYYY-MM-DD]
    const datePattern = /([\u4e00-\u9fa5][^\n\r]{10,200}?)\[(\d{4}-\d{2}-\d{2})\]/g
    let match
    while ((match = datePattern.exec(html)) !== null && policies.length < 20) {
      const rawTitle = cleanText(match[1] + `[${match[2]}]`)
      const { cleanTitle, date } = extractDate(rawTitle)

      if (cleanTitle && isPolicyTitle(cleanTitle)) {
        policies.push({ title: cleanTitle, url: targetUrl, date })
        matchedBy = 'date_pattern'
      }
    }

    // 策略2: 如果策略1失败，尝试匹配 <li> 或 <p> 标签内的内容
    if (policies.length === 0) {
      const tagPattern = /<(?:li|p|div)[^>]*>([\s\S]*?)<\/\w+>/gi
      while ((match = tagPattern.exec(html)) !== null && policies.length < 20) {
        const innerText = cleanText(match[1])
        const dateMatch = innerText.match(/(\d{4}-\d{2}-\d{2})/)
        if (dateMatch && isPolicyTitle(innerText)) {
          const { cleanTitle, date } = extractDate(innerText)
          policies.push({ title: cleanTitle, url: targetUrl, date })
          matchedBy = 'tag_pattern'
        }
      }
    }

    // 去重
    const seen = new Set<string>()
    const uniquePolicies = policies.filter(item => {
      if (seen.has(item.title)) return false
      seen.add(item.title)
      return true
    }).slice(0, 10)

    // 记录到数据库
    if (uniquePolicies.length > 0) {
      try {
        const records = uniquePolicies.map(p => ({
          policy_title: p.title,
          policy_url: p.url,
          policy_date: p.date,
          scraped_at: new Date().toISOString(),
        }))
        await supabaseAdmin.from('scrape_history').upsert(records, { onConflict: 'policy_url' })
      } catch (e) {
        console.error('记录历史失败:', e)
      }
    }

    return {
      policies: uniquePolicies,
      debug: {
        htmlLength: html.length,
        htmlSnippet: html.replace(/\s+/g, ' ').slice(0, 1500),
        encoding,
        matchedBy,
      }
    }

  } catch (error) {
    console.error('[Scraper] 抓取失败:', error)
    return {
      policies: [],
      debug: {
        htmlLength: 0,
        htmlSnippet: `Error: ${error}`,
        encoding: 'unknown',
        matchedBy: 'error',
      }
    }
  }
}

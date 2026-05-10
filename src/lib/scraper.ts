/**
 * 网页抓取模块 - 纯文本提取版
 * 策略：去掉所有HTML标签 → 在纯文本中搜索 [YYYY-MM-DD] 日期格式
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
    textLength: number
    encoding: string
    matchedBy: string
  }
}

async function fetchHtml(url: string): Promise<{ html: string; encoding: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.mofcom.gov.cn/',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  let encoding = 'utf-8'
  const headerStr = buffer.slice(0, 1024).toString('binary')
  if (/charset\s*=\s*["']?gbk/i.test(headerStr) || /charset\s*=\s*["']?gb2312/i.test(headerStr)) {
    encoding = 'gbk'
  }

  const html = iconv.decode(buffer, encoding)
  return { html, encoding }
}

function isPolicyTitle(title: string): boolean {
  if (title.length < 10 || title.length > 200) return false
  const keywords = ['通知', '公告', '规定', '办法', '细则', '决定', '批复',
    '函', '通报', '意见', '通告', '令', '目录', '清单', '调整', '措施']
  return keywords.some(k => title.includes(k))
}

function generateId(title: string): string {
  return title.replace(/\s+/g, '').slice(0, 50)
}

export async function scrapeMoFomPolicies(): Promise<ScrapeResult> {
  const targetUrl = process.env.MOFCOM_URL || 'https://www.mofcom.gov.cn/zwgk/zcfb/index.html'

  try {
    const { html, encoding } = await fetchHtml(targetUrl)

    // 获取已发送的URL（去重）
    let sentIds = new Set<string>()
    try {
      const { data } = await supabaseAdmin
        .from('scrape_history')
        .select('policy_url')
        .gte('scraped_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      sentIds = new Set(data?.map(d => d.policy_url) || [])
    } catch {}

    // 核心策略：去掉所有HTML标签，得到纯文本
    const textOnly = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')

    console.log(`[Scraper] HTML: ${html.length}, Text: ${textOnly.length}`)

    const policies: PolicyItem[] = []

    // 策略1: 匹配 "中文标题 [YYYY-MM-DD]"
    // 要求：以中文字符开头，包含政策关键词，以日期结尾
    const pattern = /([\u4e00-\u9fa5][^\[]*?(?:通知|公告|规定|办法|细则|决定|批复|函|通报|意见|通告|令|目录|清单|调整|措施))\s*\[(\d{4}-\d{2}-\d{2})\]/gi

    let match
    while ((match = pattern.exec(textOnly)) !== null && policies.length < 20) {
      const title = match[1].trim()
      const date = match[2]
      const id = generateId(title)

      if (title.length >= 10 && !sentIds.has(id)) {
        policies.push({ title, url: targetUrl, date })
      }
    }

    // 策略2: 如果策略1失败，放宽条件，匹配任何包含日期的行
    if (policies.length === 0) {
      const loosePattern = /([\u4e00-\u9fa5][^\[]{10,200}?)\[(\d{4}-\d{2}-\d{2})\]/g
      while ((match = loosePattern.exec(textOnly)) !== null && policies.length < 20) {
        const title = match[1].trim()
        const date = match[2]
        const id = generateId(title)

        if (isPolicyTitle(title) && !sentIds.has(id)) {
          policies.push({ title, url: targetUrl, date })
        }
      }
    }

    // 去重
    const seen = new Set<string>()
    const unique = policies.filter(p => {
      if (seen.has(p.title)) return false
      seen.add(p.title)
      return true
    }).slice(0, 10)

    // 记录到数据库
    if (unique.length > 0) {
      try {
        await supabaseAdmin.from('scrape_history').upsert(
          unique.map(p => ({
            policy_title: p.title,
            policy_url: generateId(p.title),
            policy_date: p.date,
            scraped_at: new Date().toISOString(),
          })),
          { onConflict: 'policy_url' }
        )
      } catch {}
    }

    console.log(`[Scraper] 抓到 ${unique.length} 条政策`)
    unique.forEach((p, i) => console.log(`  ${i + 1}. ${p.title} [${p.date}]`))

    return {
      policies: unique,
      debug: {
        htmlLength: html.length,
        textLength: textOnly.length,
        encoding,
        matchedBy: unique.length > 0 ? 'text_pattern' : 'none',
      }
    }

  } catch (error) {
    console.error('[Scraper] 失败:', error)
    return {
      policies: [],
      debug: {
        htmlLength: 0,
        textLength: 0,
        encoding: 'error',
        matchedBy: 'error',
      }
    }
  }
}

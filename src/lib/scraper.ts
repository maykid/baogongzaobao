/**
 * 网页抓取模块
 * 从商务部政务公开-政策发布栏目抓取最新政策公告
 * URL: https://www.mofcom.gov.cn/zwgk/zcfb/index.html
 * 支持 GBK/UTF-8 编码自动识别
 */

import iconv from 'iconv-lite'
import { supabaseAdmin } from './supabase'

export interface PolicyItem {
  title: string
  url: string
  date: string
}

/**
 * 获取网页原始 HTML（自动处理 GBK/UTF-8 编码）
 */
async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Referer': 'https://www.mofcom.gov.cn/',
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
  console.log(`[Scraper] 获取页面成功，编码: ${encoding}, 长度: ${html.length}`)
  return html
}

/**
 * 获取已发送过的政策 URL 列表（去重用）
 */
async function getSentUrls(): Promise<Set<string>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('scrape_history')
      .select('policy_url')
      .gte('scraped_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    if (error) {
      console.error('[Scraper] 获取历史记录失败:', error)
      return new Set()
    }

    return new Set(data?.map(d => d.policy_url) || [])
  } catch {
    return new Set()
  }
}

/**
 * 记录已发送的政策
 */
async function recordSentUrls(policies: PolicyItem[]): Promise<void> {
  try {
    const records = policies.map(p => ({
      policy_title: p.title,
      policy_url: p.url,
      policy_date: p.date,
      scraped_at: new Date().toISOString(),
    }))

    await supabaseAdmin.from('scrape_history').upsert(records, {
      onConflict: 'policy_url',
    })
  } catch (error) {
    console.error('[Scraper] 记录历史失败:', error)
  }
}

/**
 * 清理 HTML 标签和多余空白
 */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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
 * 将相对 URL 转为绝对 URL
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  try {
    const base = new URL(baseUrl)
    if (url.startsWith('/')) {
      return `${base.protocol}//${base.host}${url}`
    }
    const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1)
    return basePath + url
  } catch {
    return url
  }
}

/**
 * 从标题末尾提取日期 [YYYY-MM-DD]
 */
function extractDateFromTitle(title: string): { cleanTitle: string; date: string } {
  const dateMatch = title.match(/\[(\d{4}-\d{2}-\d{2})\]\s*$/)
  if (dateMatch) {
    return {
      cleanTitle: title.replace(/\s*\[\d{4}-\d{2}-\d{2}\]\s*$/, '').trim(),
      date: dateMatch[1],
    }
  }
  // 尝试匹配其他格式：(2026-05-02) 或 2026-05-02
  const altMatch = title.match(/[\(（](\d{4}-\d{2}-\d{2})[\)）]\s*$/)
  if (altMatch) {
    return {
      cleanTitle: title.replace(/\s*[\(（]\d{4}-\d{2}-\d{2}[\)）]\s*$/, '').trim(),
      date: altMatch[1],
    }
  }
  return { cleanTitle: title, date: new Date().toISOString().split('T')[0] }
}

/**
 * 生成唯一标识（用于去重，基于标题）
 */
function generateId(title: string): string {
  return title.replace(/\s+/g, '').slice(0, 50)
}

/**
 * 主抓取函数
 */
export async function scrapeMoFomPolicies(): Promise<PolicyItem[]> {
  const targetUrl = process.env.MOFCOM_URL || 'https://www.mofcom.gov.cn/zwgk/zcfb/index.html'

  try {
    const html = await fetchHtml(targetUrl)
    const sentUrls = await getSentUrls()
    const policies: PolicyItem[] = []

    // 策略1: 匹配 <li> 里的 <a> 链接（标准列表结构）
    const liLinkPattern = /<li[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/li>/gi
    let match
    while ((match = liLinkPattern.exec(html)) !== null && policies.length < 20) {
      const url = cleanText(match[1])
      const rawText = cleanText(match[2])
      const { cleanTitle, date } = extractDateFromTitle(rawText)
      const fullUrl = resolveUrl(url, targetUrl)

      if (cleanTitle && isPolicyTitle(cleanTitle) && !sentUrls.has(generateId(cleanTitle))) {
        policies.push({ title: cleanTitle, url: fullUrl, date })
      }
    }

    // 策略2: 匹配包含 [YYYY-MM-DD] 日期的文本行（商务部常见格式）
    if (policies.length === 0) {
      console.log('[Scraper] 策略1未匹配，尝试按日期格式匹配文本行')

      // 匹配模式：任意文本 + [YYYY-MM-DD]
      const dateLinePattern = />([^<]{20,300}?)\[(\d{4}-\d{2}-\d{2})\]</g
      while ((match = dateLinePattern.exec(html)) !== null && policies.length < 20) {
        const rawText = cleanText(match[1])
        const date = match[2]
        const { cleanTitle } = extractDateFromTitle(rawText + `[${date}]`)

        if (cleanTitle && isPolicyTitle(cleanTitle) && !sentUrls.has(generateId(cleanTitle))) {
          // 如果没有链接，使用列表页URL作为占位
          policies.push({ title: cleanTitle, url: targetUrl, date })
        }
      }
    }

    // 策略3: 匹配 <p> 或 <div> 中包含日期的段落
    if (policies.length === 0) {
      console.log('[Scraper] 策略2未匹配，尝试段落匹配')
      const paragraphPattern = /<(?:p|div)[^>]*>([^<]{30,300}?)\[(\d{4}-\d{2}-\d{2})\]<\/\w+>/gi
      while ((match = paragraphPattern.exec(html)) !== null && policies.length < 20) {
        const rawText = cleanText(match[1])
        const date = match[2]
        const { cleanTitle } = extractDateFromTitle(rawText + `[${date}]`)

        if (cleanTitle && isPolicyTitle(cleanTitle) && !sentUrls.has(generateId(cleanTitle))) {
          policies.push({ title: cleanTitle, url: targetUrl, date })
        }
      }
    }

    // 策略4: 兜底 - 匹配任何包含日期的行
    if (policies.length === 0) {
      console.log('[Scraper] 策略3未匹配，尝试兜底匹配')
      const fallbackPattern = /([\u4e00-\u9fa5].{15,200}?)\[(\d{4}-\d{2}-\d{2})\]/g
      while ((match = fallbackPattern.exec(html)) !== null && policies.length < 20) {
        const rawText = cleanText(match[1])
        const date = match[2]
        const { cleanTitle } = extractDateFromTitle(rawText + `[${date}]`)

        if (cleanTitle && isPolicyTitle(cleanTitle) && !sentUrls.has(generateId(cleanTitle))) {
          policies.push({ title: cleanTitle, url: targetUrl, date })
        }
      }
    }

    // 去重并限制数量
    const seen = new Set<string>()
    const uniquePolicies = policies.filter(item => {
      if (seen.has(item.title)) return false
      seen.add(item.title)
      return true
    }).slice(0, 10)

    console.log(`[Scraper] 共抓取 ${uniquePolicies.length} 条新政策`)
    if (uniquePolicies.length > 0) {
      uniquePolicies.forEach((p, i) => {
        console.log(`[Scraper] ${i + 1}. ${p.title} [${p.date}]`)
      })
      await recordSentUrls(uniquePolicies)
    }

    return uniquePolicies

  } catch (error) {
    console.error('[Scraper] 抓取失败:', error)
    return []
  }
}

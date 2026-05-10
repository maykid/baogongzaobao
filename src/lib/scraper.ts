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

  // 获取原始二进制数据
  const buffer = Buffer.from(await response.arrayBuffer())

  // 尝试从 Content-Type 或 HTML meta 标签检测编码
  const contentType = response.headers.get('content-type') || ''
  let encoding = 'utf-8'

  if (contentType.includes('gbk') || contentType.includes('gb2312')) {
    encoding = 'gbk'
  } else {
    // 从 HTML 前 1024 字节检测 meta charset
    const headerStr = buffer.slice(0, 1024).toString('binary')
    if (/charset\s*=\s*["']?gbk/i.test(headerStr) ||
        /charset\s*=\s*["']?gb2312/i.test(headerStr)) {
      encoding = 'gbk'
    }
  }

  // 使用 iconv-lite 解码
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
      .gte('scraped_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // 最近7天

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
 * 记录已发送的政策 URL
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
 * 清理 HTML 标签
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
  if (title.length < 5 || title.length > 100) return false

  const keywords = ['通知', '公告', '规定', '办法', '细则', '决定', '批复',
    '函', '通报', '意见', '通告', '令', '目录', '清单', '调整']
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
 * 从 HTML 中提取日期
 */
function extractDate(text: string): string {
  // 匹配 2026-05-09 或 2026/05/09 或 2026年05月09日
  const match = text.match(/(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }
  return new Date().toISOString().split('T')[0]
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

    // 策略1: 匹配 <li> 列表（最常见的政务网站结构）
    // 支持：<li>...<a href="...">标题</a>...<span>日期</span>...</li>
    const liPatterns = [
      /<li[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/li>/gi,
      /<li[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?(\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2})[\s\S]*?<\/li>/gi,
    ]

    for (const pattern of liPatterns) {
      let match
      while ((match = pattern.exec(html)) !== null && policies.length < 20) {
        const url = cleanText(match[1])
        const title = cleanText(match[2])
        const dateText = cleanText(match[3] || '')
        const fullUrl = resolveUrl(url, targetUrl)

        if (title && isPolicyTitle(title) && !sentUrls.has(fullUrl)) {
          policies.push({
            title,
            url: fullUrl,
            date: extractDate(dateText),
          })
        }
      }
    }

    // 策略2: 匹配 <tr> 表格行
    if (policies.length === 0) {
      const trPattern = /<tr[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi
      let match
      while ((match = trPattern.exec(html)) !== null && policies.length < 20) {
        const url = cleanText(match[1])
        const title = cleanText(match[2])
        const dateText = cleanText(match[3])
        const fullUrl = resolveUrl(url, targetUrl)

        if (title && isPolicyTitle(title) && !sentUrls.has(fullUrl)) {
          policies.push({
            title,
            url: fullUrl,
            date: extractDate(dateText),
          })
        }
      }
    }

    // 策略3: 通用 <a> 标签兜底
    if (policies.length === 0) {
      console.log('[Scraper] 前两种策略未匹配，尝试兜底策略')
      const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]{10,100})<\/a>/gi
      let match
      while ((match = linkPattern.exec(html)) !== null && policies.length < 15) {
        const url = cleanText(match[1])
        const title = cleanText(match[2])
        const fullUrl = resolveUrl(url, targetUrl)

        if (title && isPolicyTitle(title) && !sentUrls.has(fullUrl)) {
          policies.push({
            title,
            url: fullUrl,
            date: new Date().toISOString().split('T')[0],
          })
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

    // 记录本次抓取的 URL
    if (uniquePolicies.length > 0) {
      await recordSentUrls(uniquePolicies)
    }

    return uniquePolicies

  } catch (error) {
    console.error('[Scraper] 抓取失败:', error)
    return []
  }
}

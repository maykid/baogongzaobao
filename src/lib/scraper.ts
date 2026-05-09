/**
 * 网页抓取模块
 * 从商务部政务公开-政策发布栏目抓取最新政策公告
 * URL: https://www.mofcom.gov.cn/zwgk/zcfb/index.html
 */

export interface PolicyItem {
  title: string
  url: string
  date: string
}

/**
 * 抓取商务部政策发布栏目的最新公告
 * 适配页面: https://www.mofcom.gov.cn/zwgk/zcfb/index.html
 */
export async function scrapeMoFomPolicies(): Promise<PolicyItem[]> {
  const targetUrl = process.env.MOFCOM_URL || 'https://www.mofcom.gov.cn/zwgk/zcfb/index.html'
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const policies: PolicyItem[] = []

    // 策略1: 匹配常见的政务公开列表结构
    // 例如: <li><a href="...">标题</a><span>2026-05-09</span></li>
    const listItemRegex = /<li[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<span[^>]*>([^<]+)<\/span>)?[\s\S]*?<\/li>/gi
    
    let match
    while ((match = listItemRegex.exec(html)) !== null && policies.length < 20) {
      const url = match[1].trim()
      const title = cleanHtmlTags(match[2]).trim()
      const date = (match[3] || '').trim()
      
      if (title && title.length > 5 && isValidPolicyUrl(url)) {
        policies.push({
          title,
          url: resolveUrl(url, targetUrl),
          date: date || new Date().toISOString().split('T')[0],
        })
      }
    }

    // 策略2: 如果策略1没抓到，尝试匹配表格行结构
    if (policies.length === 0) {
      const trRegex = /<tr[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<\/tr>/gi
      while ((match = trRegex.exec(html)) !== null && policies.length < 20) {
        const url = match[1].trim()
        const title = cleanHtmlTags(match[2]).trim()
        const date = match[3].trim()
        
        if (title && title.length > 5 && isValidPolicyUrl(url)) {
          policies.push({
            title,
            url: resolveUrl(url, targetUrl),
            date: date || new Date().toISOString().split('T')[0],
          })
        }
      }
    }

    // 策略3: 通用 a 标签抓取（兜底）
    if (policies.length === 0) {
      const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi
      while ((match = linkRegex.exec(html)) !== null && policies.length < 15) {
        const url = match[1].trim()
        const title = match[2].trim()
        
        if (title.length > 8 && isValidPolicyUrl(url) && looksLikePolicyTitle(title)) {
          policies.push({
            title,
            url: resolveUrl(url, targetUrl),
            date: new Date().toISOString().split('T')[0],
          })
        }
      }
    }

    // 去重
    const seen = new Set<string>()
    const uniquePolicies = policies.filter(item => {
      if (seen.has(item.title)) return false
      seen.add(item.title)
      return true
    })

    return uniquePolicies

  } catch (error) {
    console.error('抓取商务部政策发布页失败:', error)
    return []
  }
}

/**
 * 清理 HTML 标签，保留纯文本
 */
function cleanHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
}

/**
 * 判断 URL 是否是有效的政策公告链接
 */
function isValidPolicyUrl(url: string): boolean {
  // 排除常见的非内容链接
  const excludes = ['javascript:', '#', 'mailto:', '.pdf', '.doc', '.xls']
  if (excludes.some(e => url.toLowerCase().includes(e))) return false
  
  // 排除过短的链接
  if (url.length < 3) return false
  
  return true
}

/**
 * 判断标题是否看起来像政策公告
 */
function looksLikePolicyTitle(title: string): boolean {
  const keywords = ['通知', '公告', '规定', '办法', '细则', '决定', '批复', '函', '通报', '意见']
  return keywords.some(k => title.includes(k))
}

/**
 * 将相对 URL 转为绝对 URL
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  
  const base = new URL(baseUrl)
  
  if (url.startsWith('/')) {
    return `${base.protocol}//${base.host}${url}`
  }
  
  // 去掉 baseUrl 的文件名，拼接相对路径
  const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1)
  return basePath + url
}

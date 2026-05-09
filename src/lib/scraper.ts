/**
 * 网页抓取模块
 * 从商务部网站抓取最新的进出口政策公告
 */

export interface PolicyItem {
  title: string
  url: string
  date: string
}

/**
 * 抓取商务部进出口管理栏目的最新公告
 * 注意：这里使用的是简化的抓取逻辑，实际使用时需要根据网页结构调整选择器
 */
export async function scrapeMoFomPolicies(): Promise<PolicyItem[]> {
  const targetUrl = process.env.MOFCOM_URL || 'https://www.mofcom.gov.cn/article/b/c/'
  
  try {
    // 使用 fetch 获取网页内容
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()

    // 使用正则提取公告列表（简化版）
    // 注意：实际使用时可能需要根据网页结构调整
    const policies: PolicyItem[] = []
    
    // 匹配常见的列表项模式：<a href="...">标题</a>
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi
    let match
    
    while ((match = linkRegex.exec(html)) !== null && policies.length < 20) {
      const url = match[1]
      const title = match[2].trim()
      
      // 过滤掉空标题和无关链接
      if (title && title.length > 5 && !title.includes('首页') && !title.includes('返回')) {
        // 补全相对 URL
        const fullUrl = url.startsWith('http') ? url : `https://www.mofcom.gov.cn${url}`
        
        policies.push({
          title,
          url: fullUrl,
          date: new Date().toISOString().split('T')[0], // 简化处理，实际应从网页提取日期
        })
      }
    }

    // 去重
    const uniquePolicies = policies.filter((item, index, self) => 
      index === self.findIndex((t) => t.title === item.title)
    )

    return uniquePolicies.slice(0, 10) // 最多返回 10 条

  } catch (error) {
    console.error('抓取失败:', error)
    // 返回空数组而不是抛出，避免整个流程崩溃
    return []
  }
}

/**
 * 备用抓取函数：如果主站抓取失败，可以尝试其他数据源
 */
export async function scrapeFallback(): Promise<PolicyItem[]> {
  // MVP 阶段暂时返回空数组
  // Phase 2 可以添加更多数据源
  return []
}

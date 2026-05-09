import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { scrapeMoFomPolicies } from '@/lib/scraper'
import { classifyPolicies, CATEGORIES } from '@/lib/classifier'
import { sendDigestEmail } from '@/lib/email'

/**
 * API 端点：手动或定时触发发送日报
 * GET 请求：手动触发（用于测试）
 * POST 请求：GitHub Actions 定时调用
 */
export async function GET() {
  return await generateAndSendReport()
}

export async function POST() {
  return await generateAndSendReport()
}

async function generateAndSendReport() {
  try {
    console.log('开始生成保供早报...', new Date().toISOString())

    // 1. 抓取最新政策
    const policies = await scrapeMoFomPolicies()
    
    if (policies.length === 0) {
      console.log('今日无新公告')
      return NextResponse.json({ 
        success: true, 
        message: '今日无新公告',
        sent: 0 
      })
    }

    console.log(`抓取到 ${policies.length} 条政策`)

    // 2. Kimi 分类
    const classifiedPolicies = await classifyPolicies(policies)
    console.log('分类完成')

    // 3. 按分类分组
    const categoryMap = new Map<string, typeof classifiedPolicies>()
    
    for (const policy of classifiedPolicies) {
      if (!categoryMap.has(policy.category)) {
        categoryMap.set(policy.category, [])
      }
      categoryMap.get(policy.category)!.push(policy)
    }

    // 转换为邮件需要的格式
    const policyGroups = Array.from(categoryMap.entries()).map(([key, items]) => ({
      categoryName: CATEGORIES[key as keyof typeof CATEGORIES] || '其他',
      policies: items.map(item => ({
        title: item.title,
        url: item.url,
        date: item.date,
      })),
    }))

    // 4. 获取所有活跃订阅用户
    const { data: subscribers, error: subError } = await supabaseAdmin
      .from('subscribers')
      .select('email, categories')
      .eq('active', true)

    if (subError) {
      throw subError
    }

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '没有活跃订阅用户',
        sent: 0 
      })
    }

    // 5. 给每个用户发送邮件（过滤用户不关注的分类）
    let successCount = 0
    
    for (const subscriber of subscribers) {
      // 过滤用户关注的分类
      const userCategories = subscriber.categories || []
      const filteredGroups = policyGroups.filter(group => {
        // 找到这个分类对应的 key
        const categoryKey = Object.entries(CATEGORIES).find(
          ([, name]) => name === group.categoryName
        )?.[0]
        return userCategories.includes(categoryKey) || userCategories.length === 0
      })

      // 如果过滤后没有内容，仍然发送（显示今日无相关更新）
      const success = await sendDigestEmail(subscriber.email, filteredGroups)
      if (success) successCount++
      
      // 稍微延迟，避免触发邮件服务商的频率限制
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`发送完成: ${successCount}/${subscribers.length}`)

    return NextResponse.json({
      success: true,
      message: '保供早报发送完成',
      policiesCount: policies.length,
      subscribersCount: subscribers.length,
      sent: successCount,
    })

  } catch (error) {
    console.error('生成日报失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      },
      { status: 500 }
    )
  }
}

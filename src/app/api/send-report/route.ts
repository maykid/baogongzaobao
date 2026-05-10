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
    console.log('[Report] 开始生成保供早报...', new Date().toISOString())

    // 1. 抓取最新政策
    const policies = await scrapeMoFomPolicies()
    console.log(`[Report] 抓取结果: ${policies.length} 条政策`)

    // 2. 获取所有活跃订阅用户
    const { data: subscribers, error: subError } = await supabaseAdmin
      .from('subscribers')
      .select('email, categories')
      .eq('active', true)

    if (subError) {
      throw subError
    }

    if (!subscribers || subscribers.length === 0) {
      console.log('[Report] 没有活跃订阅用户')
      return NextResponse.json({
        success: true,
        message: '没有活跃订阅用户',
        policiesCount: policies.length,
        sent: 0,
      })
    }

    console.log(`[Report] 订阅用户数: ${subscribers.length}`)

    // 3. 如果没有新政策，发送"今日无更新"邮件
    if (policies.length === 0) {
      console.log('[Report] 今日无新公告，发送提示邮件')

      let noUpdateCount = 0
      for (const subscriber of subscribers) {
        const success = await sendDigestEmail(subscriber.email, [{
          categoryName: '今日动态',
          policies: [],
        }])
        if (success) noUpdateCount++
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      return NextResponse.json({
        success: true,
        message: '今日无新公告，已发送提示邮件',
        policiesCount: 0,
        subscribersCount: subscribers.length,
        sent: noUpdateCount,
      })
    }

    // 4. Kimi 分类
    console.log('[Report] 开始 AI 分类...')
    const classifiedPolicies = await classifyPolicies(policies)
    console.log('[Report] 分类完成')

    // 5. 按分类分组
    const categoryMap = new Map<string, typeof classifiedPolicies>()

    for (const policy of classifiedPolicies) {
      if (!categoryMap.has(policy.category)) {
        categoryMap.set(policy.category, [])
      }
      categoryMap.get(policy.category)!.push(policy)
    }

    const policyGroups = Array.from(categoryMap.entries()).map(([key, items]) => ({
      categoryName: CATEGORIES[key as keyof typeof CATEGORIES] || '其他',
      policies: items.map(item => ({
        title: item.title,
        url: item.url,
        date: item.date,
      })),
    }))

    // 6. 给每个用户发送邮件
    console.log('[Report] 开始发送邮件...')
    let successCount = 0

    for (const subscriber of subscribers) {
      const userCategories = subscriber.categories || []
      const filteredGroups = policyGroups.filter(group => {
        const categoryKey = Object.entries(CATEGORIES).find(
          ([, name]) => name === group.categoryName
        )?.[0]
        return userCategories.includes(categoryKey) || userCategories.length === 0
      })

      const success = await sendDigestEmail(subscriber.email, filteredGroups)
      if (success) successCount++

      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`[Report] 发送完成: ${successCount}/${subscribers.length}`)

    return NextResponse.json({
      success: true,
      message: '保供早报发送完成',
      policiesCount: policies.length,
      subscribersCount: subscribers.length,
      sent: successCount,
    })

  } catch (error) {
    console.error('[Report] 生成日报失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

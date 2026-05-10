import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { scrapeMoFomPolicies } from '@/lib/scraper'
import { classifyPolicies, CATEGORIES } from '@/lib/classifier'
import { sendDigestEmail } from '@/lib/email'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const debug = searchParams.get('debug') === '1'
  return await generateAndSendReport(debug)
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const debug = searchParams.get('debug') === '1'
  return await generateAndSendReport(debug)
}

async function generateAndSendReport(debug: boolean = false) {
  try {
    console.log('[Report] 开始生成保供早报...', new Date().toISOString())

    // 抓取
    const { policies, debug: scrapeDebug } = await scrapeMoFomPolicies()
    console.log(`[Report] 抓取结果: ${policies.length} 条政策`)

    // 调试模式：直接返回调试信息，不发送邮件
    if (debug) {
      return NextResponse.json({
        success: true,
        policiesCount: policies.length,
        policies: policies.slice(0, 5),
        debug: scrapeDebug,
      })
    }

    // 获取订阅用户
    const { data: subscribers, error: subError } = await supabaseAdmin
      .from('subscribers')
      .select('email, categories')
      .eq('active', true)

    if (subError) throw subError

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有活跃订阅用户',
        policiesCount: policies.length,
        sent: 0,
      })
    }

    // 无政策时发送提示邮件
    if (policies.length === 0) {
      let sentCount = 0
      for (const sub of subscribers) {
        const success = await sendDigestEmail(sub.email, [{
          categoryName: '今日动态',
          policies: [],
        }])
        if (success) sentCount++
        await new Promise(r => setTimeout(r, 1000))
      }
      return NextResponse.json({
        success: true,
        message: '今日无新公告，已发送提示邮件',
        policiesCount: 0,
        subscribersCount: subscribers.length,
        sent: sentCount,
      })
    }

    // 分类
    const classified = await classifyPolicies(policies)

    // 分组
    const categoryMap = new Map<string, typeof classified>()
    for (const p of classified) {
      if (!categoryMap.has(p.category)) categoryMap.set(p.category, [])
      categoryMap.get(p.category)!.push(p)
    }

    const groups = Array.from(categoryMap.entries()).map(([key, items]) => ({
      categoryName: CATEGORIES[key as keyof typeof CATEGORIES] || '其他',
      policies: items.map(i => ({ title: i.title, url: i.url, date: i.date })),
    }))

    // 发送邮件
    let sentCount = 0
    for (const sub of subscribers) {
      const userCats = sub.categories || []
      const filtered = groups.filter(g => {
        const key = Object.entries(CATEGORIES).find(([,n]) => n === g.categoryName)?.[0]
        return userCats.includes(key) || userCats.length === 0
      })

      const success = await sendDigestEmail(sub.email, filtered)
      if (success) sentCount++
      await new Promise(r => setTimeout(r, 1000))
    }

    return NextResponse.json({
      success: true,
      message: '保供早报发送完成',
      policiesCount: policies.length,
      subscribersCount: subscribers.length,
      sent: sentCount,
    })

  } catch (error) {
    console.error('[Report] 失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

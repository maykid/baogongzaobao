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
  try {
    const body = await request.json()
    
    // 如果 GitHub Actions (Puppeteer) 传入了政策列表，直接使用
    if (body.policies && Array.isArray(body.policies)) {
      console.log(`[Report] 收到 Puppeteer 传来的 ${body.policies.length} 条政策`)
      return await sendPoliciesToSubscribers(body.policies)
    }
    
    // 否则自己抓取
    return await generateAndSendReport(false)
  } catch {
    return await generateAndSendReport(false)
  }
}

/**
 * 使用 Puppeteer 抓取的政策数据，进行分类和发送邮件
 */
async function sendPoliciesToSubscribers(policies: any[]) {
  try {
    if (policies.length === 0) {
      return await sendNoUpdateEmail()
    }

    // Kimi 分类
    const classified = await classifyPolicies(policies)

    // 按分类分组
    const categoryMap = new Map<string, typeof classified>()
    for (const p of classified) {
      if (!categoryMap.has(p.category)) categoryMap.set(p.category, [])
      categoryMap.get(p.category)!.push(p)
    }

    const groups = Array.from(categoryMap.entries()).map(([key, items]) => ({
      categoryName: CATEGORIES[key as keyof typeof CATEGORIES] || '其他',
      policies: items.map(i => ({ title: i.title, url: i.url, date: i.date })),
    }))

    // 获取订阅用户并发送
    const { data: subscribers, error: subError } = await supabaseAdmin
      .from('subscribers')
      .select('email, categories')
      .eq('active', true)

    if (subError) throw subError
    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({ success: true, message: '无订阅用户', sent: 0 })
    }

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
      message: '发送完成',
      policiesCount: policies.length,
      subscribersCount: subscribers.length,
      sent: sentCount,
    })

  } catch (error) {
    console.error('[Report] 处理失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 传统模式：自己抓取
 */
async function generateAndSendReport(debug: boolean = false) {
  try {
    const { policies, debug: scrapeDebug } = await scrapeMoFomPolicies()

    if (debug) {
      return NextResponse.json({
        success: true,
        policiesCount: policies.length,
        policies: policies.slice(0, 5),
        debug: scrapeDebug,
      })
    }

    return await sendPoliciesToSubscribers(policies)

  } catch (error) {
    console.error('[Report] 失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 发送"今日无更新"邮件
 */
async function sendNoUpdateEmail() {
  const { data: subscribers, error: subError } = await supabaseAdmin
    .from('subscribers')
    .select('email')
    .eq('active', true)

  if (subError || !subscribers) {
    return NextResponse.json({ success: true, message: '无订阅用户', sent: 0 })
  }

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

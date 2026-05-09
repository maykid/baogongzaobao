import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 创建 Supabase 服务端客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, categories } = body

    // 简单验证
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: '请输入有效的邮箱地址' },
        { status: 400 }
      )
    }

    if (!categories || categories.length === 0) {
      return NextResponse.json(
        { error: '请至少选择一个分类' },
        { status: 400 }
      )
    }

    // 检查邮箱是否已订阅
    const { data: existing } = await supabase
      .from('subscribers')
      .select('id')
      .eq('email', email)
      .single()

    if (existing) {
      // 更新分类偏好
      const { error } = await supabase
        .from('subscribers')
        .update({ categories, updated_at: new Date().toISOString() })
        .eq('id', existing.id)

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        message: '已更新您的分类偏好' 
      })
    }

    // 插入新订阅
    const { error } = await supabase
      .from('subscribers')
      .insert({
        email,
        categories,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        active: true,
      })

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      message: '订阅成功' 
    })

  } catch (error) {
    console.error('订阅失败:', error)
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    )
  }
}

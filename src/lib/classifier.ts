/**
 * Kimi AI 分类模块
 * 调用 Kimi API 对政策公告进行业务分类
 */

// 分类定义
export const CATEGORIES = {
  auto_parts: '汽车零部件进口',
  raw_materials: '原材料出口',
  tariff: '关税调整',
  license: '许可证管理',
  trade_control: '贸易管制/禁限',
  other: '其他',
} as const

export type CategoryKey = keyof typeof CATEGORIES

/**
 * 使用 Kimi API 对单条政策进行分类
 */
export async function classifyPolicy(title: string): Promise<CategoryKey> {
  const apiKey = process.env.KIMI_API_KEY
  
  if (!apiKey) {
    console.warn('KIMI_API_KEY 未配置，返回默认分类')
    return 'other'
  }

  try {
    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages: [
          {
            role: 'system',
            content: `你是一位进出口政策专家。请判断以下政策标题属于哪个业务类型。

可选分类（只返回其中一个）：
- auto_parts: 汽车零部件进口
- raw_materials: 原材料出口
- tariff: 关税调整
- license: 许可证管理
- trade_control: 贸易管制/禁限
- other: 其他

判断标准：
1. 标题含"关税""税率"的优先归 tariff
2. 标题含"许可""配额""登记"的优先归 license
3. 标题含"汽车""零部件""配件"的优先归 auto_parts
4. 标题含"原材料""矿产""钢铁""化工"的优先归 raw_materials
5. 标题含"禁止""限制""管制""制裁"的优先归 trade_control
6. 不确定时归 other

只返回分类 key（如 auto_parts），不要解释。`,
          },
          {
            role: 'user',
            content: `政策标题：${title}\n分类：`,
          },
        ],
        temperature: 0.1, // 低温度确保输出稳定
        max_tokens: 50,
      }),
    })

    if (!response.ok) {
      throw new Error(`Kimi API 错误: ${response.status}`)
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content?.trim().toLowerCase()

    // 验证返回的分类是否有效
    if (result && result in CATEGORIES) {
      return result as CategoryKey
    }

    // 如果返回了中文名称，尝试匹配
    const chineseMatch = Object.entries(CATEGORIES).find(
      ([, value]) => result?.includes(value)
    )
    if (chineseMatch) {
      return chineseMatch[0] as CategoryKey
    }

    return 'other'

  } catch (error) {
    console.error('Kimi 分类失败:', error)
    return 'other'
  }
}

/**
 * 批量分类多条政策
 */
export async function classifyPolicies(policies: { title: string; url: string; date: string }[]): Promise<
  { title: string; url: string; date: string; category: CategoryKey; categoryName: string }[]
> {
  const results = []

  for (const policy of policies) {
    const category = await classifyPolicy(policy.title)
    results.push({
      ...policy,
      category,
      categoryName: CATEGORIES[category],
    })
  }

  return results
}

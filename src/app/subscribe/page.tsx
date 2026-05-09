'use client'

import { useState } from 'react'
import Link from 'next/link'

const CATEGORIES = [
  { id: 'auto_parts', label: '汽车零部件进口' },
  { id: 'raw_materials', label: '原材料出口' },
  { id: 'tariff', label: '关税调整' },
  { id: 'license', label: '许可证管理' },
  { id: 'trade_control', label: '贸易管制/禁限' },
]

export default function SubscribePage() {
  const [email, setEmail] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'auto_parts', 'raw_materials', 'tariff', 'license', 'trade_control'
  ])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => 
      prev.includes(id) 
        ? prev.filter(c => c !== id)
        : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !email.includes('@')) {
      setStatus('error')
      setMessage('请输入有效的邮箱地址')
      return
    }

    if (selectedCategories.length === 0) {
      setStatus('error')
      setMessage('请至少选择一个关注的分类')
      return
    }

    setStatus('loading')

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, categories: selectedCategories }),
      })

      const data = await response.json()

      if (response.ok) {
        setStatus('success')
        setMessage('订阅成功！明天早上 9 点您将收到第一封保供早报。')
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.error || '订阅失败，请稍后重试')
      }
    } catch {
      setStatus('error')
      setMessage('网络错误，请检查连接后重试')
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* 导航栏 */}
      <nav className="bg-primary-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Link href="/" className="text-xl font-bold hover:text-primary-200 transition">
            ← 保供早报
          </Link>
        </div>
      </nav>

      {/* 订阅表单 */}
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">订阅保供早报</h1>
          <p className="text-gray-600 text-center mb-8">每天早上 9 点，最新进出口政策直达邮箱</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 邮箱输入 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                邮箱地址
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your-email@company.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                required
              />
            </div>

            {/* 分类选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                关注的政策分类
              </label>
              <div className="space-y-2">
                {CATEGORIES.map((cat) => (
                  <label
                    key={cat.id}
                    className="flex items-center p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="ml-3 text-gray-700">{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-primary-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? '提交中...' : '立即订阅'}
            </button>
          </form>

          {/* 状态提示 */}
          {status === 'success' && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-center">
              ✅ {message}
            </div>
          )}
          {status === 'error' && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-center">
              ❌ {message}
            </div>
          )}

          {/* 提示 */}
          <p className="mt-6 text-sm text-gray-500 text-center">
            订阅即表示您同意接收保供早报的每日邮件推送。
            <br />
            重要决策请以商务部官网为准。
          </p>
        </div>
      </div>
    </main>
  )
}

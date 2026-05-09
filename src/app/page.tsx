import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* 导航栏 */}
      <nav className="bg-primary-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">保供早报</h1>
          <Link 
            href="/subscribe" 
            className="bg-white text-primary-900 px-4 py-2 rounded-lg font-medium hover:bg-primary-50 transition"
          >
            立即订阅
          </Link>
        </div>
      </nav>

      {/* 主内容区 */}
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        {/* 标题 */}
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          每天一封邮件
          <br />
          <span className="text-primary-600">进出口政策不错过</span>
        </h2>
        
        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
          自动抓取商务部最新进出口管理规定，由 Kimi AI 智能分类，
          <br className="hidden md:block" />
          每天早上 9 点准时推送到您的邮箱。
        </p>

        {/* CTA 按钮 */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link 
            href="/subscribe"
            className="bg-primary-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-primary-700 transition shadow-lg"
          >
            免费订阅
          </Link>
          <a 
            href="#how-it-works"
            className="bg-white text-gray-700 border-2 border-gray-200 px-8 py-4 rounded-xl text-lg font-semibold hover:border-primary-300 transition"
          >
            了解原理
          </a>
        </div>

        {/* 功能特点 */}
        <div className="grid md:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">定时自动抓取</h3>
            <p className="text-gray-600">每天 9 点自动监控商务部网站，第一时间获取最新政策公告。</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Kimi 智能分类</h3>
            <p className="text-gray-600">由 Kimi AI 自动判断政策业务类型，按汽车零部件、原材料、关税等分类整理。</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">邮件准时推送</h3>
            <p className="text-gray-600">分类汇总后的政策直接发送到邮箱，无需登录任何系统，打开即看。</p>
          </div>
        </div>
      </div>

      {/* 工作原理 */}
      <section id="how-it-works" className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">工作原理</h2>
          <div className="space-y-6">
            {[
              { step: '①', title: '定时触发', desc: '每天上午 9 点自动启动任务' },
              { step: '②', title: '网页抓取', desc: '自动访问商务部网站获取最新公告' },
              { step: '③', title: 'AI 分类', desc: 'Kimi 智能判断每条政策的业务类型' },
              { step: '④', title: '邮件推送', desc: '按分类整理后发送到您的邮箱' },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-6 bg-gray-50 p-6 rounded-xl">
                <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center text-xl font-bold shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p>保供早报 · 由 Kimi 智能分类生成 · 重要决策请以商务部官网为准</p>
        </div>
      </footer>
    </main>
  )
}

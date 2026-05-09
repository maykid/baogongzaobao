import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '保供早报 - 每天自动推送进出口政策',
  description: '帮助福特保供采购人员自动监控商务部进出口管理政策，每天定时汇总分类后邮件推送',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

/**
 * 邮件发送模块
 * 使用 SMTP 发送分类后的政策汇总邮件
 */

import nodemailer from 'nodemailer'

interface PolicyGroup {
  categoryName: string
  policies: { title: string; url: string; date: string }[]
}

/**
 * 创建邮件 HTML 内容
 */
function createEmailHtml(date: string, policyGroups: PolicyGroup[]): string {
  const groupsHtml = policyGroups
    .filter(group => group.policies.length > 0)
    .map(group => `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #1e3a8a; font-size: 16px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #3b82f6;">
          ${group.categoryName}
        </h3>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${group.policies.map(p => `
            <li style="margin-bottom: 10px; padding-left: 16px; position: relative;">
              <span style="position: absolute; left: 0; color: #3b82f6;">•</span>
              <a href="${p.url}" style="color: #2563eb; text-decoration: none; font-size: 14px;">
                ${p.title}
              </a>
              <span style="color: #9ca3af; font-size: 12px; margin-left: 8px;">(${p.date})</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>保供早报</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- 标题栏 -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">保供早报</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${date} · 商务部进出口政策</p>
            </td>
          </tr>
          
          <!-- 内容区 -->
          <tr>
            <td style="padding: 32px 24px;">
              ${groupsHtml || '<p style="color: #6b7280; text-align: center;">今日暂无新公告</p>'}
            </td>
          </tr>
          
          <!-- 底部 -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                由 Kimi 智能分类 · 保供早报<br>
                重要决策请以 <a href="https://www.mofcom.gov.cn" style="color: #3b82f6;">商务部官网</a> 为准
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

/**
 * 发送汇总邮件
 */
export async function sendDigestEmail(
  toEmail: string,
  policyGroups: PolicyGroup[]
): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = parseInt(process.env.SMTP_PORT || '587')
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const fromName = process.env.FROM_NAME || '保供早报'
  const fromEmail = process.env.FROM_EMAIL || smtpUser

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error('SMTP 配置不完整')
    return false
  }

  try {
    // 创建邮件传输器
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // 465 用 SSL，587 用 TLS
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    const today = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const html = createEmailHtml(today, policyGroups)

    // 发送邮件
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: toEmail,
      subject: `保供早报 - ${today}`,
      html,
    })

    console.log('邮件发送成功:', info.messageId)
    return true

  } catch (error) {
    console.error('邮件发送失败:', error)
    return false
  }
}

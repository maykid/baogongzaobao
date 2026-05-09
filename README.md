# 保供早报

每天自动抓取商务部进出口管理最新规定，由 Kimi AI 智能分类，邮件推送给订阅用户。

## 技术栈

- **Next.js 14** + **React** + **TypeScript** — 网站框架
- **Tailwind CSS** — 样式
- **Supabase** — 数据库（存储订阅用户）
- **Kimi API** — AI 政策分类
- **Nodemailer** — 邮件发送（SMTP）
- **GitHub Actions** — 定时任务
- **Vercel** — 网站托管（免费）

## 项目结构

```
baogongzaobao/
├── .github/workflows/daily.yml    # GitHub Actions 定时任务
├── src/
│   ├── app/
│   │   ├── page.tsx               # 首页
│   │   ├── subscribe/page.tsx     # 订阅表单页
│   │   ├── api/send-report/       # 发送日报 API
│   │   └── api/subscribe/         # 订阅 API
│   └── lib/
│       ├── supabase.ts            # 数据库客户端
│       ├── scraper.ts             # 网页抓取
│       ├── classifier.ts          # Kimi AI 分类
│       └── email.ts               # 邮件发送
├── supabase/schema.sql            # 数据库表结构
└── .env.example                   # 环境变量模板
```

## 部署步骤

### 第一步：注册账号

1. **GitHub** — https://github.com/signup
2. **Supabase** — https://supabase.com（用 GitHub 登录）
3. **Vercel** — https://vercel.com（用 GitHub 登录）
4. **Kimi 开放平台** — https://platform.moonshot.cn（获取 API Key）
5. **QQ 邮箱** — 开启 SMTP 授权码

### 第二步：创建 Supabase 数据库

1. 登录 Supabase，创建新项目
2. 进入项目的 **SQL Editor**
3. 打开 `supabase/schema.sql` 文件，复制全部内容粘贴到 SQL Editor
4. 点击 **Run**，创建 `subscribers` 和 `scrape_history` 表

### 第三步：配置环境变量

1. 复制 `.env.example` 为 `.env.local`
2. 填写以下信息：

| 变量名 | 获取位置 |
|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role secret |
| `KIMI_API_KEY` | https://platform.moonshot.cn → API Keys |
| `SMTP_HOST` | QQ 邮箱: `smtp.qq.com`，163: `smtp.163.com` |
| `SMTP_PORT` | `587`（QQ/163 通用） |
| `SMTP_USER` | 你的邮箱地址，如 `123456@qq.com` |
| `SMTP_PASS` | SMTP 授权码（不是邮箱密码！） |
| `MOFCOM_URL` | 商务部栏目页 URL |

### 第四步：部署到 Vercel

1. 登录 Vercel，点击 **Add New Project**
2. 选择 **Import Git Repository**
3. 授权 Vercel 访问你的 GitHub，选择 `baogongzaobao` 仓库
4. 在环境变量（Environment Variables）区域，把 `.env.local` 里的所有变量添加进去
5. 点击 **Deploy**
6. 等待 2-3 分钟，部署完成后会获得一个网址（如 `https://baogongzaobao.vercel.app`）

### 第五步：配置 GitHub Actions 定时任务

1. 打开 GitHub 仓库 → Settings → Secrets and variables → Actions
2. 点击 **New repository secret**
3. 添加：`VERCEL_URL`，值为你的 Vercel 网站地址（如 `https://baogongzaobao.vercel.app`）
4. GitHub Actions 会自动按 `.github/workflows/daily.yml` 的设置，每天运行

### 第六步：测试

1. 打开你的网站首页，点击"免费订阅"
2. 输入测试邮箱，选择分类，提交
3. 手动触发 GitHub Actions：
   - 打开 GitHub 仓库 → Actions → Daily Policy Digest
   - 点击 **Run workflow**
4. 检查邮箱是否收到第一封保供早报

## 本地开发（可选）

```bash
# 安装依赖
npm install

# 配置环境变量（复制 .env.example 为 .env.local 并填写）

# 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

## 常见问题

**Q: 邮件发送失败？**
- 检查 SMTP 授权码是否正确（不是邮箱密码）
- 确认邮箱已开启 SMTP 服务
- 查看 Vercel 的 Function Logs 获取详细错误

**Q: 抓取不到内容？**
- 商务部网站结构可能变化，需要调整 `src/lib/scraper.ts` 中的解析逻辑
- 检查 `MOFCOM_URL` 是否正确

**Q: Kimi 分类不准确？**
- 优化 `src/lib/classifier.ts` 中的 system prompt
- 在 Kimi 平台测试不同的 prompt 效果

**Q: 定时任务没有运行？**
- GitHub Actions 的定时任务可能有 5-15 分钟延迟，属于正常
- 检查 GitHub 仓库的 Actions 页面是否有运行记录

## 注意事项

- 免费额度通常足够个人/小团队使用，注意监控用量
- 商务部网站抓取请遵守 robots.txt 和相关法规，仅用于个人学习研究
- 邮件底部已添加免责声明："重要决策请以商务部官网为准"

## 许可证

MIT License — 可自由使用和修改。

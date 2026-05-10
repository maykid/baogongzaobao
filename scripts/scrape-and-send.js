/**
 * GitHub Actions 脚本：使用 Puppeteer 抓取商务部政策，然后调用 Vercel API 发送邮件
 */

const puppeteer = require('puppeteer-core');

const MOFCOM_URL = process.env.MOFCOM_URL || 'https://www.mofcom.gov.cn/zwgk/zcfb/index.html';
const VERCEL_URL = process.env.VERCEL_URL;

if (!VERCEL_URL) {
  console.error('错误：未设置 VERCEL_URL 环境变量');
  process.exit(1);
}

async function scrapePolicies() {
  console.log('[Puppeteer] 启动 Chrome...');
  
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--lang=zh-CN,zh',
    ],
  });

  try {
    const page = await browser.newPage();
    
    // 设置中文用户代理
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9',
    });

    console.log(`[Puppeteer] 访问 ${MOFCOM_URL}...`);
    
    await page.goto(MOFCOM_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // 等待 JavaScript 渲染完成
    console.log('[Puppeteer] 等待页面渲染 (5秒)...');
    await page.waitForTimeout(5000);

    // 获取页面纯文本
    const pageText = await page.evaluate(() => {
      return document.body.innerText || '';
    });

    console.log(`[Puppeteer] 获取到 ${pageText.length} 字符文本`);

    // 在纯文本中搜索包含 [YYYY-MM-DD] 的政策
    const policies = [];
    const seen = new Set();
    
    // 匹配模式：中文标题 + [日期]
    const pattern = /([\u4e00-\u9fa5][^\[]*?(?:通知|公告|规定|办法|细则|决定|批复|函|通报|意见|通告|令|目录|清单|调整|措施))\s*\[(\d{4}-\d{2}-\d{2})\]/gi;
    
    let match;
    while ((match = pattern.exec(pageText)) !== null && policies.length < 20) {
      const title = match[1].trim();
      const date = match[2];
      
      if (title.length >= 10 && title.length <= 200 && !seen.has(title)) {
        seen.add(title);
        policies.push({ title, date, url: MOFCOM_URL });
      }
    }

    // 如果没匹配到，尝试更宽松的模式
    if (policies.length === 0) {
      console.log('[Puppeteer] 严格模式未匹配，尝试宽松模式...');
      const loosePattern = /([\u4e00-\u9fa5][^\[]{10,200}?)\[(\d{4}-\d{2}-\d{2})\]/g;
      while ((match = loosePattern.exec(pageText)) !== null && policies.length < 20) {
        const title = match[1].trim();
        const date = match[2];
        
        if (title.length >= 10 && !seen.has(title)) {
          seen.add(title);
          policies.push({ title, date, url: MOFCOM_URL });
        }
      }
    }

    console.log(`[Puppeteer] 抓到 ${policies.length} 条政策:`);
    policies.forEach((p, i) => console.log(`  ${i + 1}. ${p.title} [${p.date}]`));

    return policies;

  } catch (error) {
    console.error('[Puppeteer] 抓取失败:', error.message);
    return [];
  } finally {
    await browser.close();
    console.log('[Puppeteer] 浏览器已关闭');
  }
}

async function sendToVercel(policies) {
  const apiUrl = `${VERCEL_URL}/api/send-report`;
  console.log(`[Sender] 发送数据到 ${apiUrl}...`);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policies }),
    });

    const result = await response.json();
    console.log('[Sender] API 响应:', JSON.stringify(result, null, 2));
    
    if (!response.ok) {
      throw new Error(result.error || 'API 调用失败');
    }
    
    return result;
  } catch (error) {
    console.error('[Sender] 发送失败:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('=== 保供早报 - 开始抓取 ===');
    console.log(`时间: ${new Date().toISOString()}`);
    
    const policies = await scrapePolicies();
    
    if (policies.length === 0) {
      console.log('[Main] 未抓取到政策，仍然调用 API 发送"今日无更新"邮件');
    }
    
    await sendToVercel(policies);
    
    console.log('=== 保供早报 - 完成 ===');
  } catch (error) {
    console.error('[Main] 执行失败:', error.message);
    process.exit(1);
  }
}

main();

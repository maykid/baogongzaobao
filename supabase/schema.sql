-- 保供早报数据库表结构
-- 在 Supabase Dashboard 的 SQL Editor 中执行此脚本

-- 订阅用户表
CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  categories TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为 email 创建索引，方便快速查找
CREATE INDEX idx_subscribers_email ON subscribers(email);

-- 为 active 创建索引，方便筛选活跃用户
CREATE INDEX idx_subscribers_active ON subscribers(active);

-- 抓取历史记录表（用于去重）
CREATE TABLE scrape_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_title TEXT NOT NULL,
  policy_url TEXT NOT NULL,
  policy_date DATE,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为 policy_url 创建唯一索引，防止重复抓取
CREATE UNIQUE INDEX idx_scrape_history_url ON scrape_history(policy_url);

-- 添加 RLS（Row Level Security）策略，保护数据安全
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_history ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户插入新订阅（用于前端订阅表单）
CREATE POLICY "Allow anonymous insert" ON subscribers
  FOR INSERT WITH CHECK (true);

-- 允许匿名用户查询自己的订阅（通过邮箱匹配）
CREATE POLICY "Allow users to view own subscription" ON subscribers
  FOR SELECT USING (true);

-- 注释说明
COMMENT ON TABLE subscribers IS '保供早报订阅用户表';
COMMENT ON TABLE scrape_history IS '已抓取政策的历史记录，用于去重';

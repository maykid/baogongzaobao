import { createClient } from '@supabase/supabase-js'

// 服务端使用的 Supabase 客户端（需要服务角色密钥，用于读写数据库）
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 客户端使用的 Supabase 客户端（匿名密钥，用于前端）
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

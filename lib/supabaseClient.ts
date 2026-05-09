import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rqgzoeyyojfwyoevwhev.supabase.co'
const supabaseAnonKey = 'sb_publishable_Zt56a_KLr3rtcdqI7slvCg_mSrB0ZoM'

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)

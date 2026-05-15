import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://rqgzoeyyojfwyoewvhev.supabase.co"

const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZ3pvZXl5b2pmd3lvZXd2aGV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMTYwMzksImV4cCI6MjA5Mzg5MjAzOX0.HQQpBkihphcB1BvNBeMr5Btr-Fvh3r5gid-GmuZIvnk"

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)

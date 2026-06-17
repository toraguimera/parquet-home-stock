import { createClient } from '@supabase/supabase-js'
const SUPABASE_URL = 'https://upylrmcaaonllwvizeqc.supabase.co'
const SUPABASE_KEY = 'sb_publishable_hPDunTSF664KOiwGJ3hB9w_Y8sy01gS'
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qupgavrxqaaxcbwptrth.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cGdhdnJ4cWFheGNid3B0cnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTQ2NzYsImV4cCI6MjA4ODY5MDY3Nn0.KSAatzQdZOEkc9BzMABQm_n5d6fKK6S-N-57VyBDwUc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

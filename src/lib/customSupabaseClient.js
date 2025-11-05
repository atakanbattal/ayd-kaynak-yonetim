import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wowvecfviptpfkovblhv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvd3ZlY2Z2aXB0cGZrb3ZibGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Njc4MTEsImV4cCI6MjA3NDQ0MzgxMX0.60yCUJY28aDttmhuYhDUvhHzNk_bmC9IWmo--h00qUM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
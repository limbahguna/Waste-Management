import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ntcgtsnufvhtgaejuuzv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50Y2d0c251ZnZodGdhZWp1dXp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMjA0OTIsImV4cCI6MjA3OTg5NjQ5Mn0.QAvZJtU1njUF4kEqs02zIdGhPGezuhidMzu40bKnXQU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

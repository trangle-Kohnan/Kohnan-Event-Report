
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvnylvxmmmuzehiodubj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52bnlsdnhtbW11emVoaW9kdWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxODQxNzQsImV4cCI6MjA4NDc2MDE3NH0.lro9oPQDy-aKyZM0se8UIfW8zxvRxAsI4iB1BSGB374';

export const supabase = createClient(supabaseUrl, supabaseKey);

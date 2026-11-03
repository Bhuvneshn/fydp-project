import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Null without keys, so the app still runs locally on our own API.
export const supabase = url && key ? createClient(url, key) : null;

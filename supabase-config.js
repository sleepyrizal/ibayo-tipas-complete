// Barangay Ibayo-Tipas Portal - Supabase connection
//
// Paste YOUR project's values below (Supabase Dashboard > Project Settings > API).
// Use the Project URL and the "anon" / "publishable" key. These two are meant to be public.
// NEVER paste the "service_role" or "secret" key here.

const SUPABASE_URL = 'https://zrkvkebhfqtnzmzghzew.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpya3ZrZWJoZnF0bnptemdoemV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDE4MzUsImV4cCI6MjEwNjc3NzgzNX0.mTntXKw2U60V1IiKa7Y1Nxe980UVyWBHifJPgaOkAM0';
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_CONFIGURED =
  !SUPABASE_URL.includes('YOUR-PROJECT-ID') && !SUPABASE_ANON_KEY.includes('YOUR-ANON');

window.db = null;
if (window.supabase && window.SUPABASE_CONFIGURED) {
  window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else if (!window.SUPABASE_CONFIGURED) {
  console.error('Supabase is not configured yet. Edit supabase-config.js with your Project URL and anon key.');
} else {
  console.error('Supabase library failed to load. Check your internet connection.');
}

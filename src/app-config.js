/* ============================================================
   Kithra — built-in cloud config (single-tenant)
   The Supabase anon key is public by design (row-level security
   protects data; the Gemma/Gemini key stays server-side in the
   Edge Function). Baking it in means cloud features (accurate
   Gemini transcription, accounts, sync) work with no manual setup.
   Users can still override via Privacy → Cloud & account.
   ============================================================ */
if (typeof window !== 'undefined' && !window.KITHRA_CONFIG) {
  window.KITHRA_CONFIG = {
    SUPABASE_URL: 'https://elaruyvaroadjlhsddxb.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsYXJ1eXZhcm9hZGpsaHNkZHhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODk3MTgsImV4cCI6MjA5NjU2NTcxOH0.h3uHhlK3PNHKkmDkuCymfc1L1E6VtkWbOGedI4PjmN8',
  };
}

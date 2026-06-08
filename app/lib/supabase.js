import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://bbxpftpgibvewjekozrv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJieHBmdHBnaWJ2ZXdqZWtvenJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODc0MTEsImV4cCI6MjA5NjI2MzQxMX0.KDOGzlAabiSjdz_56jYvGh3LRK4K0UJu5Jsjnn1eiBU"
);
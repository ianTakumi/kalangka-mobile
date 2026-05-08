import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ugigkldnrrwsxdshpxjz.supabase.co";

const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnaWdrbGRucnJ3c3hkc2hweGp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI0MTgzMCwiZXhwIjoyMDkzODE3ODMwfQ.cpOomFlsIU5wjiEbsjulnqeoXv0EevnjoHjvUmQV0yg";
// Debug logging
console.log("Supabase URL exists:", !!supabaseUrl);
console.log("Supabase Key exists:", !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials!");
  console.error("URL:", supabaseUrl);
  console.error("Key:", supabaseKey);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

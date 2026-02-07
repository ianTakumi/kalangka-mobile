import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gujmgaqntmdvqvvlwqhf.supabase.co";

const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1am1nYXFudG1kdnF2dmx3cWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY3OTUxMSwiZXhwIjoyMDg1MjU1NTExfQ.idSVgwCQbv7CDhHp6F8g4c16AfEMtHTPSE0BoBqVgrM";

// Debug logging
console.log("Supabase URL exists:", !!supabaseUrl);
console.log("Supabase Key exists:", !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials!");
  console.error("URL:", supabaseUrl);
  console.error("Key:", supabaseKey);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

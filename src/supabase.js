import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

let client = null;

export async function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (client) return client;
  const module = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  client = module.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export async function signIn(email, password) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error("Configure as chaves do Supabase em src/config.js.");
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error("Configure as chaves do Supabase em src/config.js.");
  return supabase.auth.signUp({ email, password });
}

export async function resetPassword(email) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error("Configure as chaves do Supabase em src/config.js.");
  return supabase.auth.resetPasswordForEmail(email);
}

export async function syncTasks(tasks) {
  const supabase = await getSupabaseClient();
  if (!supabase) return { skipped: true };
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return { skipped: true };
  const rows = tasks.map((task) => ({ ...task, user_id: userId }));
  return supabase.from("tasks").upsert(rows, { onConflict: "id" });
}

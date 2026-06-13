import { supabase } from '@/lib/supabase'

// Uploads a file to the public "documents" bucket and returns its public URL.
export async function uploadToDocuments(file: File, folder: string) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${folder}/${Date.now()}-${safe}`
  const { error } = await supabase.storage.from('documents').upload(key, file, { upsert: false })
  if (error) return { url: null as string | null, error }
  const { data } = supabase.storage.from('documents').getPublicUrl(key)
  return { url: data.publicUrl, error: null as { message: string } | null }
}

import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';

import { getSupabase } from '@/lib/supabase';

const maxBytes = 10 * 1024 * 1024;
const allowedTypes = new Set([
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export async function pickAndUploadAttachment(conversationId?: string | null) {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...allowedTypes],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (!asset.mimeType || !allowedTypes.has(asset.mimeType)) {
    throw new Error('Choose a PDF, text file, JPEG, PNG, or WebP image.');
  }
  if ((asset.size ?? 0) > maxBytes) throw new Error('Attachments must be 10 MB or smaller.');

  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('Sign in again before uploading.');

  const extension = asset.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'bin';
  const path = `${userId}/${Crypto.randomUUID()}.${extension}`;
  const response = await fetch(asset.uri);
  const file = await response.arrayBuffer();
  const upload = await supabase.storage.from('jela-attachments').upload(path, file, {
    contentType: asset.mimeType,
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const record = await supabase
    .from('jela_attachments')
    .insert({
      owner_id: userId,
      conversation_id: conversationId ?? null,
      storage_path: path,
      file_name: asset.name,
      mime_type: asset.mimeType,
      size_bytes: asset.size ?? file.byteLength,
      status: 'ready',
    })
    .select('*')
    .single();
  if (record.error) {
    await supabase.storage.from('jela-attachments').remove([path]);
    throw record.error;
  }
  return record.data;
}

export async function createAttachmentUrl(path: string) {
  const { data, error } = await getSupabase().storage
    .from('jela-attachments')
    .createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { getSupabase } from '@/lib/supabase';

export async function pickAndUploadAvatar(userId: string) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo permission is required to choose an avatar.');
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
  if (picked.canceled) return null;
  const edited = await ImageManipulator.manipulateAsync(
    picked.assets[0].uri,
    [{ resize: { width: 512, height: 512 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
  );
  const bytes = await (await fetch(edited.uri)).arrayBuffer();
  const path = `${userId}/avatar.jpg`;
  const supabase = getSupabase();
  const { error: uploadError } = await supabase.storage.from('jela-avatars').upload(path, bytes, {
    contentType: 'image/jpeg', upsert: true, cacheControl: '3600',
  });
  if (uploadError) throw uploadError;
  const { error: profileError } = await supabase.rpc('set_jela_avatar_path', { p_avatar_path: path });
  if (profileError) throw profileError;
  return path;
}

export async function removeAvatar(path: string | null) {
  const supabase = getSupabase();
  if (path) await supabase.storage.from('jela-avatars').remove([path]);
  const { error } = await supabase.rpc('set_jela_avatar_path', { p_avatar_path: null });
  if (error) throw error;
}

export async function signedAvatarUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await getSupabase().storage.from('jela-avatars').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

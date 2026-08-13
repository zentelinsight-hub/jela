import * as DocumentPicker from 'expo-document-picker';

import { UserMessageError } from '@/lib/errors';
import { workspaceRepository } from '@/repositories/workspace-repository';

export const workspaceService = workspaceRepository;

export async function chooseAndUploadWorkspaceFile(projectId?: string | null) {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  if (asset.mimeType !== 'text/plain' && asset.mimeType !== 'application/pdf') {
    throw new UserMessageError('Workspace Files supports plain text and text-based PDF documents.');
  }
  if (!asset.size) throw new UserMessageError('Jela could not read this file size.');
  const initialized = await workspaceRepository.initFile({ name: asset.name, mimeType: asset.mimeType, size: asset.size, projectId });
  try {
    await workspaceRepository.uploadFile(initialized.upload.path, initialized.upload.token, asset.uri, asset.mimeType);
    return await workspaceRepository.processFile(initialized.file.id);
  } catch (error) {
    await workspaceRepository.deleteFile(initialized.file.id).catch(() => undefined);
    throw error;
  }
}

import { getSupabase } from '@/lib/supabase';
import type {
  JelaMemory, JelaProject, MemorySettings, WorkspaceEntitlements, WorkspaceFile,
  WorkspaceSearchResults, WorkspaceUsage,
} from '@/types/workspace';
import { cachedRequest } from '@/lib/offline-cache';

function message(data: unknown, fallback: string) {
  if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') return data.message;
  return fallback;
}

async function invoke<T>(body: Record<string, unknown>) {
  const response = await getSupabase().functions.invoke<T>('jela-workspace', { body });
  if (response.error) throw new Error(message(response.data, response.error.message));
  if (!response.data) throw new Error('The workspace returned no data.');
  return response.data;
}

export const workspaceRepository = {
  entitlements: () => invoke<{ entitlements: WorkspaceEntitlements }>({ action: 'entitlements' }),
  listProjects: (archived = false, offset = 0, limit = 30) => cachedRequest(`projects.${archived}.${offset}.${limit}`, () =>
    invoke<{ projects: JelaProject[]; hasMore: boolean }>({ action: 'list_projects', archived, offset, limit })),
  getProject: (projectId: string) => cachedRequest(`project.${projectId}`, () => invoke<{ project: JelaProject }>({ action: 'get_project', projectId })),
  createProject: (input: { name: string; description: string; instructions: string }) =>
    invoke<{ project: JelaProject }>({ action: 'create_project', ...input }),
  updateProject: (projectId: string, input: { name: string; description: string; instructions: string }) =>
    invoke<{ project: JelaProject }>({ action: 'update_project', projectId, ...input }),
  archiveProject: (projectId: string, archived: boolean) =>
    invoke<{ project: JelaProject }>({ action: archived ? 'archive_project' : 'restore_project', projectId }),
  deleteProject: (projectId: string) => invoke<{ deleted: true }>({ action: 'delete_project', projectId, confirmation: 'DELETE' }),
  createProjectConversation: (projectId: string) => invoke<{ conversationId: string }>({ action: 'create_project_conversation', projectId }),
  listMemories: (projectId?: string | null, offset = 0, limit = 30) => cachedRequest(`memories.${projectId ?? 'global'}.${offset}.${limit}`, () =>
    invoke<{ memories: JelaMemory[]; hasMore: boolean }>({ action: 'list_memories', projectId: projectId ?? null, offset, limit })),
  createMemory: (input: { content: string; category: JelaMemory['category']; scope?: JelaMemory['scope']; projectId?: string | null }) =>
    invoke<{ memory: JelaMemory }>({ action: 'create_memory', scope: input.scope ?? 'global', projectId: input.projectId ?? null, content: input.content, category: input.category }),
  updateMemory: (memoryId: string, content: string, category: JelaMemory['category']) =>
    invoke<{ memory: JelaMemory }>({ action: 'update_memory', memoryId, content, category }),
  pinMemory: (memoryId: string, pinned: boolean) => invoke<{ memory: JelaMemory }>({ action: 'pin_memory', memoryId, pinned }),
  deleteMemory: (memoryId: string) => invoke<{ deleted: true }>({ action: 'delete_memory', memoryId }),
  clearMemories: () => invoke<{ cleared: true }>({ action: 'clear_memories', confirmation: 'FORGET' }),
  memorySettings: (settings?: { enabled: boolean; rememberUseful: boolean; referenceConversations: boolean; projectMemory: boolean; onboarded?: boolean }) =>
    invoke<{ settings: MemorySettings }>({ action: 'memory_settings', ...(settings ? { settings } : {}) }),
  listFiles: (projectId?: string | null, offset = 0, limit = 30) => cachedRequest(`files.${projectId ?? 'global'}.${offset}.${limit}`, () =>
    invoke<{ files: WorkspaceFile[]; hasMore: boolean }>({ action: 'list_files', projectId: projectId ?? null, offset, limit })),
  initFile: (input: { name: string; mimeType: string; size: number; projectId?: string | null }) =>
    invoke<{ file: WorkspaceFile; upload: { path: string; token: string } }>({ action: 'init_file', ...input, projectId: input.projectId ?? null }),
  processFile: (fileId: string, reprocess = false) => invoke<{ file: WorkspaceFile }>({ action: reprocess ? 'reprocess_file' : 'process_file', fileId }),
  deleteFile: (fileId: string) => invoke<{ deleted: true }>({ action: 'delete_file', fileId }),
  deleteGeneratedImage: (imageId: string) => invoke<{ deleted: true }>({ action: 'delete_generated_image', imageId, confirmation: 'DELETE' }),
  deleteConversation: (conversationId: string) => invoke<{ deleted: true }>({ action: 'delete_conversation', conversationId, confirmation: 'DELETE' }),
  uploadFile: async (path: string, token: string, uri: string, mimeType: string) => {
    const response = await fetch(uri);
    const bytes = await response.arrayBuffer();
    const uploaded = await getSupabase().storage.from('jela-workspace-files').uploadToSignedUrl(path, token, bytes, { contentType: mimeType });
    if (uploaded.error) throw uploaded.error;
  },
  search: (query: string) => invoke<{ results: WorkspaceSearchResults }>({ action: 'search', query }),
  usage: () => invoke<WorkspaceUsage>({ action: 'usage' }),
};

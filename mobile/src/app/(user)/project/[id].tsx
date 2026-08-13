import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Archive, FileText, Images, MessageSquarePlus, Pencil, Pin, Search, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { AppText } from '@/components/app-text'; import { Button } from '@/components/button';
import { ErrorState, LoadingState } from '@/components/feedback-state'; import { PageScreen } from '@/components/page-screen';
import { SectionCard } from '@/components/section-card'; import { SettingRow } from '@/components/setting-row';
import { useAppTheme } from '@/contexts/theme-context'; import { friendlyError } from '@/lib/errors';
import { workspaceService } from '@/services/workspace'; import type { JelaProject } from '@/types/workspace';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter(); const { colors } = useAppTheme();
  const [project, setProject] = useState<JelaProject | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { try { const found = (await workspaceService.getProject(id)).project; setProject(found); setError(null); } catch (caught) { setError(friendlyError(caught, 'This project could not be loaded.')); } finally { setLoading(false); } }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const newChat = async () => { try { const result = await workspaceService.createProjectConversation(id); router.push({ pathname: '/(user)/conversation/[id]', params: { id: result.conversationId } }); } catch (caught) { setError(friendlyError(caught, 'A project chat could not be created.')); } };
  const remove = () => Alert.alert('Delete project?', 'Chats will remain in History, while project files and project memory will be permanently removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void workspaceService.deleteProject(id).then(() => router.replace('/(user)/projects' as Href)).catch((caught) => setError(friendlyError(caught, 'Project could not be deleted.'))) }]);
  return <PageScreen title={project?.name ?? 'Project'} subtitle="Focused Jela workspace">{loading ? <LoadingState /> : error && !project ? <ErrorState message={error} onRetry={() => void load()} /> : project ? <View style={{ gap: 14 }}>
    <SectionCard><AppText variant="title">{project.name}</AppText><AppText tone="muted">{project.description || 'Keep related chats, files and context together.'}</AppText>{project.instructions ? <><AppText variant="label">Instructions</AppText><AppText>{project.instructions}</AppText></> : null}</SectionCard>
    <Button icon={<MessageSquarePlus color="#FFFFFF" size={18} />} onPress={() => void newChat()}>Start Project Chat</Button>
    <SettingRow icon={<FileText color={colors.primary} />} title="Files" description="Upload and search project text files" onPress={() => router.push({ pathname: '/(user)/files', params: { projectId: id } } as Href)} />
    <SettingRow icon={<Pin color={colors.accent} />} title="Memory" description="View facts isolated to this project" onPress={() => router.push({ pathname: '/(user)/memory', params: { projectId: id } } as Href)} />
    <SettingRow icon={<Search color={colors.primary} />} title="Research" description="Start a project chat and choose Research mode" onPress={() => void newChat()} />
    <SettingRow icon={<Images color={colors.accent} />} title="Images" description="Browse images created inside this project" onPress={() => router.push({ pathname: '/(user)/images', params: { projectId: id } } as Href)} />
    <SettingRow icon={<Pencil color={colors.textMuted} />} title="Instructions" description="Edit project identity and persistent instructions" onPress={() => router.push({ pathname: '/(user)/project/[id]/edit', params: { id } } as Href)} />
    <SettingRow icon={<Archive color={colors.textMuted} />} title={project.archived_at ? 'Restore project' : 'Archive project'} onPress={() => void workspaceService.archiveProject(id, !project.archived_at).then(load).catch((caught) => setError(friendlyError(caught, 'Project could not be updated.')))} />
    <SettingRow icon={<Trash2 color={colors.danger} />} title="Delete project" description="Permanently remove project files and memory" danger onPress={remove} />
    {error ? <AppText tone="danger" variant="caption">{error}</AppText> : null}
  </View> : null}</PageScreen>;
}

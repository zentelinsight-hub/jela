import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Archive, MessageSquareText } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { useAppTheme } from '@/contexts/theme-context';
import { formatDate } from '@/lib/format';
import { friendlyError } from '@/lib/errors';
import { archiveConversation, listConversations } from '@/services/conversations';
import { radius } from '@/theme/tokens';
import type { Conversation } from '@/types/database';

export function ConversationList({ query = '' }: { query?: string }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listConversations(query)); setError(null); }
    catch (loadError) { setError(friendlyError(loadError, 'Could not load your conversations.')); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { const timeout = setTimeout(() => void load(), query ? 250 : 0); return () => clearTimeout(timeout); }, [load, query]);

  if (loading) return <LoadingState label="Loading history…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!items.length) {
    return <EmptyState title={query ? 'No matching conversations' : 'No conversation history yet'} message={query ? 'Try a different word or phrase.' : 'New conversations will appear here after you send your first message.'} action={!query ? <Button onPress={() => router.replace('/(user)')}>Start a chat</Button> : undefined} />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      contentContainerStyle={{ paddingBottom: 24 }}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/(user)/conversation/${item.id}` as Href)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
            borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
          })}
        >
          <MessageSquareText color={colors.primary} size={22} />
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="label" numberOfLines={2}>{item.title}</AppText>
            <AppText tone="muted" variant="caption">Updated {formatDate(item.updated_at)}</AppText>
          </View>
          <Pressable
            accessibilityLabel={`Archive ${item.title}`}
            hitSlop={10}
            onPress={async (event) => {
              event.stopPropagation();
              try { await archiveConversation(item.id); setItems((current) => current.filter((entry) => entry.id !== item.id)); }
              catch (archiveError) { setError(friendlyError(archiveError, 'Could not archive this conversation.')); }
            }}
            style={{ padding: 7 }}
          >
            <Archive color={colors.textMuted} size={19} />
          </Pressable>
        </Pressable>
      )}
    />
  );
}

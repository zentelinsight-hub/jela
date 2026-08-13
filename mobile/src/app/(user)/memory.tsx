import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import {
  Brain,
  Pin,
  PinOff,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/feedback-state";
import { PageScreen } from "@/components/page-screen";
import { SectionCard } from "@/components/section-card";
import { useAppTheme } from "@/contexts/theme-context";
import { friendlyError } from "@/lib/errors";
import { workspaceService } from "@/services/workspace";
import type { JelaMemory } from "@/types/workspace";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

const labels: Record<string, string> = {
  about_you: "About You",
  preferences: "Preferences",
  work_business: "Work & Business",
  learning: "Learning",
  project: "Projects",
  other: "Other",
};

export default function MemoryScreen() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<JelaMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const result = await workspaceService.listMemories(projectId);
      setItems(result.memories);
      setHasMore(result.hasMore);
      setError(null);
    } catch (caught) {
      setError(friendlyError(caught, "Memory could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await workspaceService.listMemories(projectId, items.length);
      setItems((current) => [...current, ...result.memories]);
      setHasMore(result.hasMore);
    } catch (caught) { setError(friendlyError(caught, "More memories could not be loaded.")); }
    finally { setLoadingMore(false); }
  };
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();
    const channel = supabase.channel(`memories-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jela_memories", filter: `owner_id=eq.${user.id}` }, () => void load())
      .subscribe();
    const state = AppState.addEventListener("change", (next) => { if (next === "active") void load(); });
    return () => { state.remove(); void supabase.removeChannel(channel); };
  }, [load, user]);
  const remove = (item: JelaMemory) =>
    Alert.alert("Forget this memory?", item.content, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Forget",
        style: "destructive",
        onPress: () => void workspaceService.deleteMemory(item.id).then(load),
      },
    ]);
  return (
    <PageScreen
      title={projectId ? "Project Memory" : "Memory"}
      subtitle="What Jela can remember for you"
      action={
        !projectId ? (
          <Pressable
            accessibilityLabel="Memory settings"
            onPress={() => router.push("/(user)/memory-settings" as Href)}
          >
            <Settings2 color={colors.text} />
          </Pressable>
        ) : undefined
      }
    >
      <Button
        icon={<Plus color="#FFFFFF" size={18} />}
        onPress={() =>
          router.push({
            pathname: "/(user)/memory-edit",
            params: { projectId: projectId ?? "" },
          } as Href)
        }
      >
        Add Memory
      </Button>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Brain color={colors.primary} size={38} />}
          title="Nothing saved yet"
          message="Add something useful for Jela to remember. Conversation history remains separate."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {items.map((item) => (
            <SectionCard key={item.id}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <View style={{ flex: 1, gap: 5 }}>
                  <AppText variant="caption" tone="accent">
                    {labels[item.category] ?? "Other"} · {item.scope}
                  </AppText>
                  <AppText>{item.content}</AppText>
                  <AppText variant="caption" tone="muted">
                    {item.source_type === "manual"
                      ? "Added by you"
                      : "Remembered by Jela"}
                  </AppText>
                </View>
                <Pressable
                  accessibilityLabel={
                    item.pinned ? "Unpin memory" : "Pin memory"
                  }
                  onPress={() =>
                    void workspaceService
                      .pinMemory(item.id, !item.pinned)
                      .then(load)
                  }
                >
                  {item.pinned ? (
                    <PinOff color={colors.accent} />
                  ) : (
                    <Pin color={colors.textMuted} />
                  )}
                </Pressable>
                <Pressable
                  accessibilityLabel="Forget memory"
                  onPress={() => remove(item)}
                >
                  <Trash2 color={colors.danger} />
                </Pressable>
              </View>
              <Button
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/(user)/memory-edit",
                    params: {
                      memoryId: item.id,
                      content: item.content,
                      category: item.category,
                      projectId: item.project_id ?? "",
                    },
                  } as Href)
                }
              >
                Edit
              </Button>
            </SectionCard>
          ))}
          {hasMore ? <Button variant="secondary" loading={loadingMore} onPress={() => void loadMore()}>Load more memories</Button> : null}
        </View>
      )}
    </PageScreen>
  );
}

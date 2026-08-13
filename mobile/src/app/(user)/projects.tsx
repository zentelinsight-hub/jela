import { useFocusEffect, useRouter, type Href } from "expo-router";
import { Archive, FolderKanban, Plus } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, View } from "react-native";

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
import type { JelaProject } from "@/types/workspace";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

export default function ProjectsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [projects, setProjects] = useState<JelaProject[]>([]);
  const [archived, setArchived] = useState<JelaProject[]>([]);
  const [hasMoreProjects, setHasMoreProjects] = useState(false);
  const [hasMoreArchived, setHasMoreArchived] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [active, inactive] = await Promise.all([
        workspaceService.listProjects(),
        workspaceService.listProjects(true),
      ]);
      setProjects(active.projects);
      setArchived(inactive.projects);
      setHasMoreProjects(active.hasMore);
      setHasMoreArchived(inactive.hasMore);
      setError(null);
    } catch (caught) {
      setError(friendlyError(caught, "Projects could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);
  const loadMore = async (includeArchived: boolean) => {
    setLoadingMore(true);
    try {
      const current = includeArchived ? archived : projects;
      const result = await workspaceService.listProjects(includeArchived, current.length);
      if (includeArchived) {
        setArchived((items) => [...items, ...result.projects]);
        setHasMoreArchived(result.hasMore);
      } else {
        setProjects((items) => [...items, ...result.projects]);
        setHasMoreProjects(result.hasMore);
      }
    } catch (caught) { setError(friendlyError(caught, "More projects could not be loaded.")); }
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
    const channel = supabase
      .channel(`projects-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jela_projects",
          filter: `owner_id=eq.${user.id}`,
        },
        () => void load(),
      )
      .subscribe();
    const state = AppState.addEventListener("change", (next) => {
      if (next === "active") void load();
    });
    return () => {
      state.remove();
      void supabase.removeChannel(channel);
    };
  }, [load, user]);
  return (
    <PageScreen
      title="Projects"
      subtitle="Keep related chats, files and context together"
    >
      <Button
        icon={<Plus color="#FFFFFF" size={18} />}
        onPress={() => router.push("/(user)/new-project" as Href)}
      >
        New Project
      </Button>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : projects.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon={<FolderKanban color={colors.primary} size={38} />}
          title="Create your first project"
          message="Give Jela a focused space with persistent instructions, chats, files and memory."
          action={
            <Button onPress={() => router.push("/(user)/new-project" as Href)}>
              Create Project
            </Button>
          }
        />
      ) : (
        <View style={{ gap: 18 }}>
          <View style={{ gap: 10 }}>
            <AppText variant="title">Recent Projects</AppText>
            {projects.map((project) => (
              <Pressable
                key={project.id}
                onPress={() =>
                  router.push({
                    pathname: "/(user)/project/[id]",
                    params: { id: project.id },
                  } as Href)
                }
              >
                <SectionCard>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <FolderKanban color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="label">{project.name}</AppText>
                      <AppText tone="muted" variant="caption" numberOfLines={2}>
                        {project.description || "Focused Jela workspace"}
                      </AppText>
                    </View>
                  </View>
                </SectionCard>
              </Pressable>
            ))}
            {hasMoreProjects ? <Button variant="secondary" loading={loadingMore} onPress={() => void loadMore(false)}>Load more projects</Button> : null}
          </View>
          {archived.length ? (
            <View style={{ gap: 10 }}>
              <AppText variant="title">Archived</AppText>
              {archived.map((project) => (
                <Pressable
                  key={project.id}
                  onPress={() =>
                    router.push({
                      pathname: "/(user)/project/[id]",
                      params: { id: project.id },
                    } as Href)
                  }
                >
                  <SectionCard>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <Archive color={colors.textMuted} />
                      <AppText>{project.name}</AppText>
                    </View>
                  </SectionCard>
                </Pressable>
              ))}
              {hasMoreArchived ? <Button variant="secondary" loading={loadingMore} onPress={() => void loadMore(true)}>Load more archived projects</Button> : null}
            </View>
          ) : null}
        </View>
      )}
    </PageScreen>
  );
}

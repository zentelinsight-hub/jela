import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { FileText, RefreshCw, Trash2, Upload } from "lucide-react-native";
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
import { formatDate } from "@/lib/format";
import {
  chooseAndUploadWorkspaceFile,
  workspaceService,
} from "@/services/workspace";
import type { WorkspaceFile } from "@/types/workspace";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
const size = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`;
export default function FilesScreen() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const result = await workspaceService.listFiles(projectId);
      setFiles(result.files);
      setHasMore(result.hasMore);
      setError(null);
    } catch (caught) {
      setError(friendlyError(caught, "Files could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await workspaceService.listFiles(projectId, files.length);
      setFiles((items) => [...items, ...result.files]);
      setHasMore(result.hasMore);
    } catch (caught) { setError(friendlyError(caught, "More files could not be loaded.")); }
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
    const channel = supabase.channel(`files-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jela_files", filter: `owner_id=eq.${user.id}` }, () => void load())
      .subscribe();
    const state = AppState.addEventListener("change", (next) => { if (next === "active") void load(); });
    return () => { state.remove(); void supabase.removeChannel(channel); };
  }, [load, user]);
  useEffect(() => {
    if (
      !files.some(
        (file) => file.status === "uploading" || file.status === "processing",
      )
    )
      return;
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [files, load]);
  const upload = async () => {
    setUploading(true);
    setError(null);
    try {
      const result = await chooseAndUploadWorkspaceFile(projectId);
      if (result) await load();
    } catch (caught) {
      setError(friendlyError(caught, "The file could not be uploaded."));
      await load();
    } finally {
      setUploading(false);
    }
  };
  const remove = (file: WorkspaceFile) =>
    Alert.alert(
      "Delete file?",
      `${file.original_name} and its searchable content will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void workspaceService.deleteFile(file.id).then(load),
        },
      ],
    );
  return (
    <PageScreen
      title={projectId ? "Project Files" : "Files"}
      subtitle="Private, persistent workspace documents"
    >
      <Button
        loading={uploading}
        icon={<Upload color="#FFFFFF" size={18} />}
        onPress={() => void upload()}
      >
        Upload Document
      </Button>
      <AppText tone="muted" variant="caption">
        Plain text and text-based PDF files are processed privately in the
        background. Your plan controls the maximum file size.
      </AppText>
      {loading ? (
        <LoadingState />
      ) : error && files.length === 0 ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : files.length === 0 ? (
        <EmptyState
          icon={<FileText color={colors.primary} size={38} />}
          title="No workspace files"
          message="Upload a document once, then Jela can retrieve only relevant sections in future chats."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {files.map((file) => (
            <SectionCard key={file.id}>
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <FileText
                  color={
                    file.status === "ready"
                      ? colors.success
                      : file.status === "unable_to_process"
                        ? colors.danger
                        : colors.primary
                  }
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText variant="label" numberOfLines={1}>
                    {file.original_name}
                  </AppText>
                  <AppText tone="muted" variant="caption">
                    {size(file.size_bytes)} · {file.status.replaceAll("_", " ")}{" "}
                    · {formatDate(file.updated_at)}
                  </AppText>
                  {file.status === "processing" ? (
                    <AppText tone="muted" variant="caption">
                      Jela is extracting and indexing this document. You can
                      leave this page.
                    </AppText>
                  ) : null}
                  {file.status === "unable_to_process" ? (
                    <AppText tone="danger" variant="caption">
                      Unable to process. The original file remains private and
                      available for retry.
                    </AppText>
                  ) : null}
                </View>
                {file.status === "unable_to_process" ? (
                  <Pressable
                    accessibilityLabel="Reprocess file"
                    onPress={() =>
                      void workspaceService
                        .processFile(file.id, true)
                        .then(load)
                        .catch((caught) =>
                          setError(
                            friendlyError(caught, "File processing failed."),
                          ),
                        )
                    }
                  >
                    <RefreshCw color={colors.primary} />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityLabel="Delete file"
                  onPress={() => remove(file)}
                >
                  <Trash2 color={colors.danger} />
                </Pressable>
              </View>
            </SectionCard>
          ))}
          {hasMore ? <Button variant="secondary" loading={loadingMore} onPress={() => void loadMore()}>Load more files</Button> : null}
        </View>
      )}
      {error && files.length ? (
        <AppText tone="danger" variant="caption">
          {error}
        </AppText>
      ) : null}
    </PageScreen>
  );
}

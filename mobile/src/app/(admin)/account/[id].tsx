import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, Switch, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { ErrorState, LoadingState } from "@/components/feedback-state";
import { PageScreen } from "@/components/page-screen";
import { SectionCard } from "@/components/section-card";
import { TextField } from "@/components/text-field";
import { getSupabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import {
  fetchAccountWorkspaceState,
  fetchAdminAccounts,
  setAccountStatus,
  setUserAiOverride,
  type AdminAccountRow,
} from "@/services/admin";
import { deleteAccount } from "@/services/security";
import type { AccountStatus } from "@/types/database";

type Row = AdminAccountRow & { status_reason?: string | null };
const editableFeatureKeys = [
  "chat_enabled", "memory_enabled", "auto_memory_enabled", "projects_enabled", "workspace_files_enabled",
  "file_analysis_enabled", "project_memory_enabled", "project_instructions_enabled", "image_generation_enabled",
  "research", "deep_think", "voice_enabled",
] as const;
const editableLimitKeys = [
  "memory_item_limit", "storage_bytes_limit", "max_projects", "image_generation_limit", "web_search_limit",
  "max_file_size", "max_project_files",
] as const;

export default function AdminAccountDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [account, setAccount] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Awaited<
    ReturnType<typeof fetchAccountWorkspaceState>
  > | null>(null);
  const [overrideFeatures, setOverrideFeatures] = useState<Record<string, boolean>>({});
  const [overrideLimits, setOverrideLimits] = useState<Record<string, string>>({});
  const [overrideReason, setOverrideReason] = useState("");
  const load = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const [result, nextWorkspace] = await Promise.all([
          fetchAdminAccounts(id, 1, 0),
          fetchAccountWorkspaceState(id),
        ]);
        setAccount((result.rows[0] as Row | undefined) ?? null);
        setWorkspace(nextWorkspace);
        const overrideConfig = nextWorkspace.override?.override_config ?? {};
        const nestedFeatures = overrideConfig.features && typeof overrideConfig.features === "object"
          ? overrideConfig.features as Record<string, boolean> : overrideConfig as Record<string, boolean>;
        const nestedLimits = overrideConfig.limits && typeof overrideConfig.limits === "object"
          ? overrideConfig.limits as Record<string, number> : {};
        setOverrideFeatures(Object.fromEntries(editableFeatureKeys.map((key) => [key,
          nestedFeatures[key] ?? nextWorkspace.entitlements.features[key]
            ?? (key === "research" ? nextWorkspace.entitlements.features.research_enabled : false),
        ])));
        setOverrideLimits(Object.fromEntries(editableLimitKeys.map((key) => [key,
          String(nestedLimits[key] ?? nextWorkspace.entitlements.limits[key] ?? 0),
        ])));
        setError(result.rows[0] ? null : "Account not found.");
      } catch (caught) {
        setError(friendlyError(caught, "Could not load this account."));
      }
      if (showLoading) setLoading(false);
    },
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!id) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`admin-account-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jela_accounts",
          filter: `id=eq.${id}`,
        },
        () => void load(false),
      )
      .subscribe();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void load(false);
    });
    return () => {
      appState.remove();
      void supabase.removeChannel(channel);
    };
  }, [id, load]);
  const changeStatus = async (status: AccountStatus) => {
    if (status !== "active" && reason.trim().length < 3) {
      setError("Enter a clear reason before restricting access.");
      return;
    }
    const previous = account;
    setAccount((current) =>
      current
        ? {
            ...current,
            status,
            status_reason: status === "active" ? null : reason.trim(),
          }
        : current,
    );
    setWorking(true);
    setError(null);
    try {
      await setAccountStatus(id, status, reason);
    } catch (e) {
      setAccount(previous);
      setError(friendlyError(e, "Could not change account status."));
    } finally {
      setWorking(false);
    }
  };
  const override = async (defaults: boolean) => {
    setWorking(true);
    try {
      await setUserAiOverride(
        id,
        defaults,
        defaults ? {} : { chat_enabled: false },
      );
      await load(false);
      setError(null);
    } catch (e) {
      setError(friendlyError(e, "Could not update the AI override."));
    } finally {
      setWorking(false);
    }
  };
  const saveDetailedOverride = async () => {
    if (overrideReason.trim().length < 3) { setError("Enter a clear audit reason for this override."); return; }
    const limits = Object.fromEntries(Object.entries(overrideLimits).map(([key, value]) => [key, Number(value)]));
    if (Object.values(limits).some((value) => !Number.isFinite(value) || value < 0)) {
      setError("All user limits must be valid non-negative numbers."); return;
    }
    setWorking(true); setError(null);
    try {
      await setUserAiOverride(id, false, { features: overrideFeatures, limits }, overrideReason.trim());
      setOverrideReason(""); await load(false);
    } catch (caught) { setError(friendlyError(caught, "Could not save this entitlement override.")); }
    finally { setWorking(false); }
  };
  const remove = async () => {
    if (confirmation !== "DELETE") {
      setError("Type DELETE exactly to confirm.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await deleteAccount("DELETE", id);
      router.replace("/(admin)/accounts");
    } catch (caught) {
      setError(friendlyError(caught, "The account was not deleted."));
    } finally {
      setWorking(false);
    }
  };
  return (
    <PageScreen
      title="Account"
      subtitle="Server-authoritative identity and controls"
    >
      {loading ? (
        <LoadingState />
      ) : error && !account ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : account ? (
        <View style={{ gap: 14 }}>
          <SectionCard
            title={
              account.display_name ||
              `${account.first_name} ${account.last_name}`
            }
          >
            <AppText
              tone={account.status === "active" ? "success" : "danger"}
              variant="label"
            >
              {account.status}
            </AppText>
            <AppText>{account.email ?? "No email"}</AppText>
            {account.username ? (
              <AppText tone="muted">
                @{account.username} · Age {account.age ?? "—"}
              </AppText>
            ) : null}
            <AppText tone="muted">
              Plan: {account.plan_name ?? "Free"}
              {account.subscription_status
                ? ` · ${account.subscription_status}`
                : ""}
            </AppText>
            {account.is_admin ? (
              <AppText tone="accent" variant="label">
                Protected administrator account
              </AppText>
            ) : null}
            {account.status_reason ? (
              <AppText tone="muted">Reason: {account.status_reason}</AppText>
            ) : null}
            <AppText tone="muted" variant="caption">
              User ID: {account.id}
            </AppText>
          </SectionCard>
          {workspace ? (
            <SectionCard title="Workspace policy & private metrics">
              <AppText variant="label">
                {workspace.override && !workspace.override.use_plan_defaults
                  ? "User Override"
                  : "Inherited from Plan"}
              </AppText>
              <AppText tone="muted">
                Projects {workspace.workspace.projects} · Memory {workspace.workspace.memories} · Files {workspace.workspace.files} · Images {workspace.workspace.images}
              </AppText>
              <AppText tone="muted">
                Storage {(workspace.workspace.storage_bytes / 1048576).toFixed(1)} MB
              </AppText>
              <AppText tone="muted" variant="caption">
                Content is intentionally hidden. Admin sees only counts and the effective policy.
              </AppText>
            </SectionCard>
          ) : null}
          <TextField
            label="Status reason"
            value={reason}
            onChangeText={setReason}
            multiline
            hint="Required for restricted, suspended, or deactivated states."
          />
          <View style={{ gap: 9 }}>
            <Button
              loading={working}
              onPress={() => void changeStatus("active")}
            >
              Set active
            </Button>
            <Button
              variant="secondary"
              loading={working}
              onPress={() => void changeStatus("restricted")}
            >
              Set restricted
            </Button>
            <Button
              variant="danger"
              loading={working}
              onPress={() => void changeStatus("suspended")}
            >
              Suspend account
            </Button>
            <Button
              variant="danger"
              loading={working}
              onPress={() => void changeStatus("deactivated")}
            >
              Deactivate Jela AI account
            </Button>
          </View>
          <SectionCard title="AI override">
            <AppText tone="muted">
              Account overrides inherit the plan by default and are audited
              server-side.
            </AppText>
            <Button
              variant="secondary"
              loading={working}
              onPress={() => void override(true)}
            >
              Reset to Plan Defaults
            </Button>
            <Button
              variant="danger"
              loading={working}
              onPress={() => void override(false)}
            >
              Disable Chat for this account
            </Button>
            {workspace ? <>
              <AppText variant="label">Effective capabilities</AppText>
              {Object.keys(overrideFeatures).sort().map((key) => <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <AppText style={{ flex: 1 }}>{key.replaceAll("_", " ")}</AppText>
                <Switch accessibilityLabel={`Override ${key.replaceAll("_", " ")}`} value={overrideFeatures[key] === true}
                  onValueChange={(value) => setOverrideFeatures((current) => ({ ...current, [key]: value }))} />
              </View>)}
              <AppText variant="label">Effective limits</AppText>
              {Object.keys(overrideLimits).sort().map((key) => <TextField key={key} label={key.replaceAll("_", " ")}
                value={overrideLimits[key]} onChangeText={(value) => setOverrideLimits((current) => ({ ...current, [key]: value }))}
                keyboardType="numeric" />)}
              <TextField label="Override audit reason" value={overrideReason} onChangeText={setOverrideReason}
                hint="Required and recorded in the Audit Log." />
              <Button loading={working} onPress={() => void saveDetailedOverride()}>Save user entitlement override</Button>
            </> : null}
          </SectionCard>
          {!account.is_admin ? (
            <SectionCard title="Permanent deletion">
              <AppText tone="muted">
                This uses the same cancellation, private-storage cleanup, data
                cascade, and authentication deletion pipeline as self-deletion.
              </AppText>
              <TextField
                label="Type DELETE to confirm"
                value={confirmation}
                onChangeText={setConfirmation}
                autoCapitalize="characters"
              />
              <Button
                variant="danger"
                loading={working}
                disabled={confirmation !== "DELETE"}
                onPress={() => void remove()}
              >
                Delete account permanently
              </Button>
            </SectionCard>
          ) : null}
          {error ? <AppText tone="danger">{error}</AppText> : null}
        </View>
      ) : null}
    </PageScreen>
  );
}

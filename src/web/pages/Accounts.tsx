import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import CenteredModal from "../components/CenteredModal.js";
import DeleteConfirmModal from "../components/DeleteConfirmModal.js";
import ModernSelect from "../components/ModernSelect.js";
import ResponsiveFormGrid from "../components/ResponsiveFormGrid.js";
import { useToast } from "../components/Toast.js";
import { MobileCard, MobileField } from "../components/MobileCard.js";
import { useIsMobile } from "../components/useIsMobile.js";
import SiteBadgeLink from "../components/SiteBadgeLink.js";
import AccountModelsModal from "./accounts/AccountModelsModal.js";
import {
  buildAddAccountPrereqHint,
  buildVerifyFailureHint,
  normalizeVerifyFailureMessage,
} from "./helpers/accountVerifyFeedback.js";
import {
  clearFocusParams,
  readFocusAccountIntent,
} from "./helpers/navigationFocus.js";
import { resolveAccountCredentialMode } from "./helpers/accountConnection.js";
import { parseBatchApiKeys } from "../../shared/apiKeyBatch.js";

type ApiKeyForm = {
  siteId: number;
  username: string;
  accessToken: string;
  skipModelFetch: boolean;
};

const emptyForm = (): ApiKeyForm => ({
  siteId: 0,
  username: "",
  accessToken: "",
  skipModelFetch: false,
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 13,
  outline: "none",
  background: "var(--color-bg)",
  color: "var(--color-text-primary)",
};

function displayName(account: any) {
  const username = typeof account?.username === "string" ? account.username.trim() : "";
  return username || "API Key 连接";
}

function statusBadge(account: any) {
  const status = String(account?.status || "active").toLowerCase();
  if (status === "active") return { label: "可用", cls: "badge-success" };
  if (status === "disabled") return { label: "已禁用", cls: "badge-muted" };
  if (status === "expired") return { label: "需检查 Key", cls: "badge-warning" };
  return { label: status || "未知", cls: "badge-info" };
}

function normalizeModels(result: any) {
  return Array.isArray(result?.models) ? result.models : [];
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<ApiKeyForm>(() => emptyForm());
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ username: "", apiToken: "", status: "active", proxyUrl: "" });
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [highlightAccountId, setHighlightAccountId] = useState<number | null>(null);
  const [modelModal, setModelModal] = useState({
    open: false,
    account: null as any | null,
    models: [] as Array<{ name: string; latencyMs: number | null; disabled: boolean; isManual?: boolean }>,
    pendingDisabled: new Set<string>(),
    loading: false,
    saving: false,
    siteName: "",
    manualModelsInput: "",
    addingManualModels: false,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const toast = useToast();
  const modelModalRequestSeqRef = useRef(0);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async (forceRefresh = false) => {
    try {
      const snapshot = await api.getAccountsSnapshot(forceRefresh ? { refresh: true } : undefined);
      setAccounts(Array.isArray(snapshot?.accounts) ? snapshot.accounts : []);
      setSites(Array.isArray(snapshot?.sites) ? snapshot.sites : []);
    } catch (error: any) {
      toast.error(error?.message || "加载 API Key 连接失败");
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let changed = false;
    if (params.get("segment") && params.get("segment") !== "apikey") {
      params.set("segment", "apikey");
      changed = true;
    }
    if (!params.get("segment")) {
      params.set("segment", "apikey");
      changed = true;
    }
    if (changed) {
      navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!loaded) return;
    const intent = readFocusAccountIntent(location.search);
    if (!intent.accountId) return;
    setHighlightAccountId(intent.accountId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightAccountId(null), 2800);
    navigate(
      { pathname: location.pathname, search: clearFocusParams(location.search) },
      { replace: true },
    );
  }, [loaded, location, navigate]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const apiKeyAccounts = useMemo(
    () => accounts.filter((account) => resolveAccountCredentialMode(account) === "apikey"),
    [accounts],
  );

  const siteOptions = useMemo(
    () => [
      { value: "0", label: "选择站点" },
      ...sites.map((site: any) => ({
        value: String(site.id),
        label: `${site.name} (${site.platform})`,
        description: site.url || undefined,
      })),
    ],
    [sites],
  );

  const selectedSite = useMemo(
    () => sites.find((site: any) => site.id === form.siteId) || null,
    [form.siteId, sites],
  );
  const parsedApiKeys = useMemo(() => parseBatchApiKeys(form.accessToken), [form.accessToken]);
  const isBatchApiKeyInput = parsedApiKeys.length > 1;
  const verifyFailureHint = buildVerifyFailureHint(verifyResult);
  const addAccountPrereqHint = buildAddAccountPrereqHint(verifyResult);

  const closeAddPanel = () => {
    setShowAdd(false);
    setForm(emptyForm());
    setVerifyResult(null);
    setVerifying(false);
    setSaving(false);
  };

  const handleVerify = async () => {
    if (!form.siteId || !form.accessToken.trim()) return;
    if (isBatchApiKeyInput) {
      toast.info(`检测到 ${parsedApiKeys.length} 个 API Key，批量模式会在添加时逐条校验`);
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await api.verifyToken({
        siteId: form.siteId,
        accessToken: form.accessToken.trim(),
        credentialMode: "apikey",
      });
      setVerifyResult(result);
      if (result?.success && result?.tokenType === "apikey") {
        toast.success(`API Key 验证成功（可用模型 ${result.modelCount || 0} 个）`);
      } else {
        toast.error(normalizeVerifyFailureMessage(result?.message || "API Key 无效"));
      }
    } catch (error: any) {
      toast.error(normalizeVerifyFailureMessage(error?.message));
      setVerifyResult({ success: false, message: error?.message });
    } finally {
      setVerifying(false);
    }
  };

  const handleAdd = async () => {
    if (!form.siteId || !form.accessToken.trim()) return;
    if (!isBatchApiKeyInput && !verifyResult?.success && !form.skipModelFetch) {
      toast.error("请先验证 API Key 成功后再添加连接");
      return;
    }
    setSaving(true);
    try {
      const result = await api.addAccount({
        siteId: form.siteId,
        username: form.username.trim() || undefined,
        accessToken: form.accessToken,
        accessTokens: isBatchApiKeyInput ? parsedApiKeys : undefined,
        credentialMode: "apikey",
        skipModelFetch: form.skipModelFetch,
      });
      closeAddPanel();
      if (result?.batch) {
        const created = Number(result.createdCount) || 0;
        const failed = Number(result.failedCount) || 0;
        toast.success(`批量添加完成：成功 ${created}，失败 ${failed}`);
      } else if (result?.queued) {
        toast.info(result.message || "API Key 连接已添加，后台正在初始化模型。");
      } else {
        toast.success("API Key 连接已添加");
      }
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || "添加 API Key 连接失败");
    } finally {
      setSaving(false);
    }
  };

  const withLoading = async (key: string, fn: () => Promise<void>, successMsg?: string) => {
    setActionLoading((state) => ({ ...state, [key]: true }));
    try {
      await fn();
      if (successMsg) toast.success(successMsg);
    } catch (error: any) {
      toast.error(error?.message || "操作失败");
    } finally {
      setActionLoading((state) => ({ ...state, [key]: false }));
      void load(true);
    }
  };

  const openEdit = (account: any) => {
    setEditing(account);
    setEditForm({
      username: account?.username || "",
      apiToken: account?.apiToken || "",
      status: account?.status || "active",
      proxyUrl: account?.extraConfig?.proxyUrl || "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.updateAccount(editing.id, {
        username: editForm.username.trim() || undefined,
        apiToken: editForm.apiToken.trim() || undefined,
        status: editForm.status,
        proxyUrl: editForm.proxyUrl.trim() || undefined,
        credentialMode: "apikey",
      });
      setEditing(null);
      toast.success("API Key 连接已更新");
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || "更新 API Key 连接失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const account = deleteTarget;
    setActionLoading((state) => ({ ...state, [`delete-${account.id}`]: true }));
    try {
      await api.deleteAccount(account.id);
      setDeleteTarget(null);
      toast.success("API Key 连接已删除");
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || "删除 API Key 连接失败");
    } finally {
      setActionLoading((state) => ({ ...state, [`delete-${account.id}`]: false }));
    }
  };

  const openModelModal = async (account: any) => {
    await loadModelModalModels(account, { resetBeforeLoad: true, closeOnError: true });
  };

  const applyLoadedModelModal = (account: any, result: any) => {
    const models = normalizeModels(result);
    setModelModal((state) => ({
      ...state,
      loading: false,
      models,
      pendingDisabled: new Set<string>(models.filter((model: any) => model.disabled).map((model: any) => model.name)),
      siteName: result?.siteName || account?.site?.name || state.siteName,
    }));
  };

  const loadModelModalModels = async (
    account: any,
    options: { refreshUpstream?: boolean; resetBeforeLoad?: boolean; closeOnError?: boolean; successMessage?: string } = {},
  ) => {
    const requestId = ++modelModalRequestSeqRef.current;
    setModelModal((state) => ({
      ...state,
      open: true,
      account,
      loading: true,
      ...(options.resetBeforeLoad
        ? { models: [], pendingDisabled: new Set<string>(), siteName: "", manualModelsInput: "" }
        : {}),
    }));
    try {
      if (options.refreshUpstream) await api.checkModels(account.id);
      const result = await api.getAccountModels(account.id);
      if (modelModalRequestSeqRef.current !== requestId) return;
      applyLoadedModelModal(account, result);
      if (options.successMessage) toast.success(options.successMessage);
    } catch (error: any) {
      if (modelModalRequestSeqRef.current !== requestId) return;
      toast.error(error?.message || "加载模型列表失败");
      setModelModal((state) =>
        options.closeOnError
          ? { ...state, open: false, account: null, loading: false }
          : { ...state, loading: false },
      );
    }
  };

  const closeModelModal = () => {
    modelModalRequestSeqRef.current += 1;
    setModelModal((state) => ({
      ...state,
      open: false,
      account: null,
      manualModelsInput: "",
      addingManualModels: false,
    }));
  };

  const toggleModelDisabled = (modelName: string) => {
    setModelModal((state) => {
      const next = new Set(state.pendingDisabled);
      if (next.has(modelName)) next.delete(modelName);
      else next.add(modelName);
      return { ...state, pendingDisabled: next };
    });
  };

  const saveModelDisabled = async () => {
    if (!modelModal.account) return;
    setModelModal((state) => ({ ...state, saving: true }));
    try {
      await api.updateSiteDisabledModels(modelModal.account.siteId, Array.from(modelModal.pendingDisabled));
      await api.rebuildRoutes(false, false);
      toast.success("模型设置已保存，路由已重建");
      closeModelModal();
    } catch (error: any) {
      toast.error(error?.message || "保存模型设置失败");
    } finally {
      setModelModal((state) => ({ ...state, saving: false }));
    }
  };

  const handleAddManualModels = async () => {
    if (!modelModal.account || !modelModal.manualModelsInput.trim()) return;
    const models = modelModal.manualModelsInput.split(",").map((model) => model.trim()).filter(Boolean);
    if (models.length === 0) return;
    setModelModal((state) => ({ ...state, addingManualModels: true }));
    try {
      await api.addAccountAvailableModels(modelModal.account.id, models);
      toast.success("模型已手动添加");
      setModelModal((state) => ({ ...state, manualModelsInput: "" }));
      await loadModelModalModels(modelModal.account);
    } catch (error: any) {
      toast.error(error?.message || "手动添加模型失败");
    } finally {
      setModelModal((state) => ({ ...state, addingManualModels: false }));
    }
  };

  const renderRows = () => {
    if (!loaded) {
      return (
        <div className="empty-state">
          <div className="spinner" />
          <div className="empty-state-title">加载 API Key 连接中...</div>
        </div>
      );
    }
    if (apiKeyAccounts.length === 0) {
      return (
        <div className="empty-state">
          <svg className="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 7a4 4 0 11-8 0 4 4 0 018 0zM7 21a6 6 0 0110.8-3.6M15.5 18.5l2-2m0 0l2 2m-2-2V21" />
          </svg>
          <div className="empty-state-title">暂无 API Key 连接</div>
          <div className="empty-state-desc">
            {sites.length > 0 ? "为站点添加 API Key 后即可用于模型发现和代理转发。" : "请先添加站点，然后为站点补充 API Key。"}
          </div>
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="mobile-card-list">
          {apiKeyAccounts.map((account) => {
            const badge = statusBadge(account);
            return (
              <MobileCard
                key={account.id}
                title={displayName(account)}
                subtitle={account.site?.name || "-"}
                className={highlightAccountId === account.id ? "row-focus-highlight" : ""}
              >
                <MobileField label="类型" value="API Key" />
                <MobileField label="状态" value={<span className={`badge ${badge.cls}`}>{badge.label}</span>} />
                <MobileField label="模型数" value={String(account.modelCount ?? account.availableModelCount ?? "-")} />
                <div className="mobile-card-actions">
                  <button className="btn btn-link btn-link-info" onClick={() => openModelModal(account)}>模型</button>
                  <button className="btn btn-link btn-link-primary" onClick={() => withLoading(`models-${account.id}`, () => api.checkModels(account.id), "模型检查已完成")}>检查模型</button>
                  <button className="btn btn-link btn-link-info" onClick={() => openEdit(account)}>编辑</button>
                  <button className="btn btn-link btn-link-danger" onClick={() => setDeleteTarget(account)}>删除</button>
                </div>
              </MobileCard>
            );
          })}
        </div>
      );
    }

    return (
      <table className="data-table accounts-table">
        <thead>
          <tr>
            <th>连接名称</th>
            <th>站点</th>
            <th>状态</th>
            <th>模型</th>
            <th>已用</th>
            <th style={{ textAlign: "right" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {apiKeyAccounts.map((account, index) => {
            const badge = statusBadge(account);
            return (
              <tr
                key={account.id}
                data-testid={`account-row-${account.id}`}
                className={`animate-slide-up stagger-${Math.min(index + 1, 5)} ${highlightAccountId === account.id ? "row-focus-highlight" : ""}`.trim()}
              >
                <td>
                  <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{displayName(account)}</div>
                  <div style={{ marginTop: 4 }}>
                    <span className="badge badge-warning" style={{ fontSize: 10 }}>API Key</span>
                  </div>
                </td>
                <td>
                  <SiteBadgeLink siteId={account.site?.id} siteName={account.site?.name} badgeStyle={{ fontSize: 11 }} />
                </td>
                <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                <td>{account.modelCount ?? account.availableModelCount ?? "-"}</td>
                <td>${(account.balanceUsed || 0).toFixed(2)}</td>
                <td style={{ textAlign: "right" }}>
                  <div className="accounts-row-actions">
                    <button className="btn btn-link btn-link-info" onClick={() => openModelModal(account)}>模型</button>
                    <button
                      className="btn btn-link btn-link-primary"
                      disabled={!!actionLoading[`models-${account.id}`]}
                      onClick={() => withLoading(`models-${account.id}`, () => api.checkModels(account.id), "模型检查已完成")}
                    >
                      {actionLoading[`models-${account.id}`] ? <span className="spinner spinner-sm" /> : "检查模型"}
                    </button>
                    <button className="btn btn-link btn-link-info" onClick={() => openEdit(account)}>编辑</button>
                    <button className="btn btn-link btn-link-danger" onClick={() => setDeleteTarget(account)}>删除</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>API Key 连接</h1>
          <p>管理上游 Base URL + API Key 连接，用于模型发现、路由生成和代理调用。</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>添加 API Key</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>连接概览</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>当前页面只管理 API Key 连接。</div>
          </div>
          <button className="btn btn-ghost" onClick={() => void load(true)}>
            刷新列表
          </button>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">API Key 连接</div>
            <div className="stat-value">{apiKeyAccounts.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">可用站点</div>
            <div className="stat-value">{sites.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">连接方式</div>
            <div className="stat-value" style={{ fontSize: 20 }}>API Key</div>
          </div>
        </div>
      </div>

      <div className="card">{renderRows()}</div>

      <CenteredModal
        open={showAdd}
        onClose={closeAddPanel}
        title={isBatchApiKeyInput ? "批量添加 API Key 连接" : "添加 API Key 连接"}
        maxWidth={720}
        footer={(
          <>
            <button className="btn btn-ghost" onClick={closeAddPanel}>取消</button>
            <button
              className="btn btn-ghost"
              onClick={handleVerify}
              disabled={verifying || !form.siteId || !form.accessToken.trim() || isBatchApiKeyInput}
            >
              {verifying ? <><span className="spinner spinner-sm" />验证中...</> : "验证 Key"}
            </button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !form.siteId || !form.accessToken.trim()}>
              {saving ? <><span className="spinner spinner-sm" />保存中...</> : "添加连接"}
            </button>
          </>
        )}
      >
        <ResponsiveFormGrid minColumnWidth={260}>
          <div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>站点</div>
            <ModernSelect
              value={String(form.siteId || 0)}
              onChange={(value) => {
                setForm((state) => ({ ...state, siteId: Number.parseInt(value, 10) || 0 }));
                setVerifyResult(null);
              }}
              options={siteOptions}
              placeholder="选择站点"
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>连接名称</div>
            <input
              style={inputStyle}
              value={form.username}
              onChange={(event) => setForm((state) => ({ ...state, username: event.target.value }))}
              placeholder={selectedSite ? `${selectedSite.name} API Key` : "例如：OpenAI 主 Key"}
            />
          </div>
        </ResponsiveFormGrid>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>API Key</div>
          <textarea
            style={{ ...inputStyle, minHeight: 120, fontFamily: "var(--font-mono)", resize: "vertical" }}
            value={form.accessToken}
            onChange={(event) => {
              setForm((state) => ({ ...state, accessToken: event.target.value }));
              setVerifyResult(null);
            }}
            placeholder="粘贴 API Key；批量导入时每行一个 Key"
          />
          {isBatchApiKeyInput && (
            <div className="alert alert-info" style={{ marginTop: 8 }}>
              已识别 {parsedApiKeys.length} 个 API Key，添加时会逐条创建连接。
            </div>
          )}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={form.skipModelFetch}
            onChange={(event) => setForm((state) => ({ ...state, skipModelFetch: event.target.checked }))}
          />
          暂不拉取模型，先保存连接
        </label>
        {verifyResult?.success && verifyResult?.tokenType === "apikey" && (
          <div className="alert alert-success" style={{ marginTop: 12 }}>
            <div className="alert-title">API Key 可用</div>
            <div>检测到 {verifyResult.modelCount || 0} 个可用模型。</div>
          </div>
        )}
        {verifyResult && (!verifyResult.success || verifyResult.tokenType !== "apikey") && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            <div className="alert-title">API Key 验证失败</div>
            <div>{normalizeVerifyFailureMessage(verifyResult.message || "当前凭证不是 API Key")}</div>
            {verifyFailureHint && <div style={{ marginTop: 6 }}>{verifyFailureHint}</div>}
            {addAccountPrereqHint && <div style={{ marginTop: 6 }}>{addAccountPrereqHint}</div>}
          </div>
        )}
      </CenteredModal>

      <CenteredModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="编辑 API Key 连接"
        maxWidth={640}
        footer={(
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>取消</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
              {saving ? <><span className="spinner spinner-sm" />保存中...</> : "保存"}
            </button>
          </>
        )}
      >
        <ResponsiveFormGrid minColumnWidth={240}>
          <div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>连接名称</div>
            <input style={inputStyle} value={editForm.username} onChange={(event) => setEditForm((state) => ({ ...state, username: event.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>状态</div>
            <ModernSelect
              value={editForm.status}
              onChange={(value) => setEditForm((state) => ({ ...state, status: value }))}
              options={[
                { value: "active", label: "可用" },
                { value: "disabled", label: "已禁用" },
              ]}
            />
          </div>
        </ResponsiveFormGrid>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>替换 API Key</div>
          <input
            style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
            value={editForm.apiToken}
            onChange={(event) => setEditForm((state) => ({ ...state, apiToken: event.target.value }))}
            placeholder="留空则不修改"
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>代理地址（可选）</div>
          <input
            style={inputStyle}
            value={editForm.proxyUrl}
            onChange={(event) => setEditForm((state) => ({ ...state, proxyUrl: event.target.value }))}
            placeholder="http://127.0.0.1:7890"
          />
        </div>
      </CenteredModal>

      <DeleteConfirmModal
        open={Boolean(deleteTarget)}
        title="删除 API Key 连接"
        description={deleteTarget ? `确认删除「${displayName(deleteTarget)}」？相关路由通道会随连接删除。` : ""}
        loading={deleteTarget ? !!actionLoading[`delete-${deleteTarget.id}`] : false}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <AccountModelsModal
        modelModal={modelModal}
        inputStyle={inputStyle}
        onClose={closeModelModal}
        onSave={saveModelDisabled}
        onRefresh={async () => {
          if (!modelModal.account) return;
          await loadModelModalModels(modelModal.account, { refreshUpstream: true, successMessage: "模型列表已刷新" });
        }}
        onToggleModelDisabled={toggleModelDisabled}
        onSetPendingDisabled={(pendingDisabled) => setModelModal((state) => ({ ...state, pendingDisabled }))}
        onManualInputChange={(value) => setModelModal((state) => ({ ...state, manualModelsInput: value }))}
        onAddManualModels={handleAddManualModels}
      />
    </div>
  );
}

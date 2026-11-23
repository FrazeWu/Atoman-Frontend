import { apiRequestResult } from '@/api/client'
import { reportError } from '@/utils/logger'
import { onScopeDispose, ref } from "vue";
import { defineStore, getActivePinia } from "pinia";
import { registerSessionReset } from "@/stores/sessionReset";
import type {
  CreateDebateChallengeInput,
  CreateDebateEntryInput,
  Debate,
  DebateChallenge,
  DebateChallengeVoteDecision,
  DebateConclusionEvent,
  DebateEntry,
  DebateEvidenceRating,
  DebateGraph,
  DebateRevision,
  DebateRevisionDiff,
  DebateStatus,
  DebateVoteDirection,
  DebateVoteSummary,
  UpdateDebateEntryInput,
} from "@/types";
import { useAuthStore } from "@/stores/auth";
import { useApi } from '@/composables/useApi'
import { referencePublishErrorMessage } from '@/composables/useReferenceAutocomplete'

const api = useApi();

type WikiConcurrencyPayload = {
  base_revision: string;
  edit_summary: string;
};

type SaveWikiPayload = WikiConcurrencyPayload & {
  title: string;
  description: string;
  content: string;
  tags: string[];
};

type SaveWikiResult =
  | { ok: true; debate: Debate }
  | {
      ok: false;
      conflict?: { base_revision_id: string; current_revision_id: string };
    };

type DebateListMeta = {
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
};

type OwnedRequest = {
  sequence: number;
  ownerID: string | null;
};

const beginOwnedRequest = (request: OwnedRequest, ownerID: string) => {
  request.sequence += 1;
  request.ownerID = ownerID;
  return request.sequence;
};

const ownsRequest = (request: OwnedRequest, ownerID: string, sequence: number) => (
  request.sequence === sequence && request.ownerID === ownerID
);

const invalidateOwnedRequest = (request: OwnedRequest) => {
  request.sequence += 1;
  request.ownerID = null;
};

export const useDebateStore = defineStore("debate", () => {
  const debates = ref<Debate[]>([]);
  const debatesTotal = ref(0);
  const debatesMeta = ref<DebateListMeta>({ page: 1, page_size: 20, total: 0, has_more: false });
  const currentDebate = ref<Debate | null>(null);
  const voteSummary = ref<DebateVoteSummary | null>(null);
  const revisions = ref<DebateRevision[]>([]);
	const relationGraph = ref<DebateGraph | null>(null);
	const relationLoading = ref(false);
  const entries = ref<DebateEntry[]>([]);
  const entriesLoading = ref(false);
  const challenges = ref<DebateChallenge[]>([]);
  const challengesLoading = ref(false);
  const loading = ref(false);
  const wikiSaving = ref(false);
  const revisionsLoading = ref(false);
  const votesLoading = ref(false);
  const error = ref<string | null>(null);
  let debatesRequestSequence = 0;
  let currentDebateLoadingSequence = 0;
  let wikiSaveRequestSequence = 0;
  const currentDebateRequest: OwnedRequest = { sequence: 0, ownerID: null };
  const revisionsRequest: OwnedRequest = { sequence: 0, ownerID: null };
  const votesRequest: OwnedRequest = { sequence: 0, ownerID: null };
  const relationGraphRequest: OwnedRequest = { sequence: 0, ownerID: null };
  const entriesRequest: OwnedRequest = { sequence: 0, ownerID: null };
  const challengesRequest: OwnedRequest = { sequence: 0, ownerID: null };

  const authHeaders = (): Record<string, string> => {
    const authStore = useAuthStore();
    return authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {};
  };

  const beginCurrentDebateMutation = (id: string) => {
    const requestSequence = beginOwnedRequest(currentDebateRequest, id);
    const isCurrent = () => ownsRequest(currentDebateRequest, id, requestSequence);
    return {
      isCurrent,
      commit: () => {
        if (!isCurrent()) return false;
        beginOwnedRequest(currentDebateRequest, id);
        currentDebateLoadingSequence += 1;
        loading.value = false;
        return true;
      },
    };
  };

  const fetchDebates = async (
    params: {
      status?: DebateStatus;
      search?: string;
      tag?: string;
      page?: number;
      pageSize?: number;
      /** @deprecated Use pageSize. */
      limit?: number;
    } = {},
  ) => {
    const requestSequence = ++debatesRequestSequence;
    loading.value = true;
    error.value = null;
    try {
      const query = new URLSearchParams();
      if (params.status) query.set("status", params.status);
      if (params.search) query.set("search", params.search);
      if (params.tag) query.set("tag", params.tag);
      if (params.page) query.set("page", String(params.page));
      const pageSize = params.pageSize ?? params.limit;
      if (pageSize) query.set("page_size", String(pageSize));

      const res = await apiRequestResult(`${api.url}/debate/topics?${query}`);
      if (requestSequence !== debatesRequestSequence) return false;
      if (!res.ok) throw new Error(`Failed to fetch debates (${res.status})`);
      const data = res.data;
      if (requestSequence !== debatesRequestSequence) return false;
      const rows = data.data || [];
      debates.value = (params.page || 1) > 1 ? [...debates.value, ...rows] : rows;
      debatesMeta.value = {
        page: data.meta?.page ?? params.page ?? 1,
        page_size: data.meta?.page_size ?? pageSize ?? 20,
        total: data.meta?.total ?? rows.length,
        has_more: Boolean(data.meta?.has_more),
      };
      debatesTotal.value = debatesMeta.value.total;
      return true;
    } catch (e) {
      if (requestSequence !== debatesRequestSequence) return false;
      error.value = "获取辩题列表失败，请重试";
      reportError(e);
      return false;
    } finally {
      if (requestSequence === debatesRequestSequence) loading.value = false;
    }
  };

  const fetchDebate = async (id: string) => {
    const requestSequence = beginOwnedRequest(currentDebateRequest, id);
    const loadingSequence = ++currentDebateLoadingSequence;
    loading.value = true;
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${id}`);
      if (!ownsRequest(currentDebateRequest, id, requestSequence)) return null;
      if (res.ok) {
        const data = res.data;
        if (!ownsRequest(currentDebateRequest, id, requestSequence)) return null;
        currentDebate.value = data.data;
        return data.data as Debate;
      } else {
        error.value = "辩题不存在或已被删除";
        return null;
      }
    } catch (e) {
      if (!ownsRequest(currentDebateRequest, id, requestSequence)) return null;
      error.value = "获取辩题失败，请重试";
      reportError(e);
      return null;
    } finally {
      if (loadingSequence === currentDebateLoadingSequence) loading.value = false;
    }
  };

  const fetchRelationGraph = async (
      id: string,
      view: 'tree' | 'graph' = 'tree',
      depth?: number,
    ): Promise<DebateGraph | null> => {
      const depthQuery = depth === undefined ? '' : `&depth=${depth}`
      const url = `${api.url}/debates/${id}/relations?view=${view}${depthQuery}`

      // The topic page owns and merges expansion fragments into its current root graph.
      if (depth === 1) {
        try {
          const res = await apiRequestResult(url)
          if (!res.ok) return null
          const payload = res.data
          return payload.data as DebateGraph
        } catch (e) {
          reportError(e, 'Failed to fetch debate relation fragment')
          return null
        }
      }

      const requestSequence = beginOwnedRequest(relationGraphRequest, id)
      relationLoading.value = true
      error.value = null
      try {
        const res = await apiRequestResult(url)
        if (!ownsRequest(relationGraphRequest, id, requestSequence)) return null
        if (!res.ok) {
          error.value = '获取关联关系失败，请重试'
          return null
        }
        const payload = res.data
        if (!ownsRequest(relationGraphRequest, id, requestSequence)) return null
        relationGraph.value = payload.data as DebateGraph
        return relationGraph.value
      } catch (e) {
        if (!ownsRequest(relationGraphRequest, id, requestSequence)) return null
        error.value = '获取关联关系失败，请重试'
        reportError(e, 'Failed to fetch debate relations')
        return null
      } finally {
        if (ownsRequest(relationGraphRequest, id, requestSequence)) relationLoading.value = false
      }
    }

  const createDebate = async (payload: {
    title: string;
    description: string;
    content: string;
    tags: string[];
  }): Promise<Debate | null> => {
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = res.data;
        return data.data as Debate;
      } else {
        const responseError = res.data;
        error.value = referencePublishErrorMessage(responseError, "创建失败，请重试");
      }
    } catch (e) {
      error.value = referencePublishErrorMessage(e, "创建失败，请重试");
      reportError(e, "Failed to create debate");
    }
    return null;
  };

  const saveWiki = async (
    id: string,
    payload: SaveWikiPayload,
  ): Promise<SaveWikiResult> => {
    const mutation = beginCurrentDebateMutation(id);
    const saveSequence = ++wikiSaveRequestSequence;
    wikiSaving.value = true;
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const responsePayload = res.data;
      if (res.ok) {
        const debate = responsePayload.data as Debate;
        if (mutation.commit()) currentDebate.value = debate;
        return { ok: true, debate };
      }

      const apiError = responsePayload.error;
      if (res.status === 409 && apiError?.code === "debate.edit_conflict") {
        const details = apiError.details;
        if (
          typeof details?.base_revision_id === "string"
          && typeof details?.current_revision_id === "string"
        ) {
          return {
            ok: false,
            conflict: {
              base_revision_id: details.base_revision_id,
              current_revision_id: details.current_revision_id,
            },
          };
        }
      }

      if (mutation.isCurrent()) {
        error.value = referencePublishErrorMessage(responsePayload, apiError?.message || "保存失败，请重试");
      }
      return { ok: false };
    } catch (e) {
      if (mutation.isCurrent()) error.value = referencePublishErrorMessage(e, "保存失败，请重试");
      reportError(e, "Failed to save debate");
      return { ok: false };
    } finally {
      if (saveSequence === wikiSaveRequestSequence) wikiSaving.value = false;
    }
  };

  const fetchRevisions = async (id: string): Promise<DebateRevision[] | null> => {
    const requestSequence = beginOwnedRequest(revisionsRequest, id);
    revisionsLoading.value = true;
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${id}/revisions`);
      if (!ownsRequest(revisionsRequest, id, requestSequence)) return null;
      if (!res.ok) {
        error.value = "获取版本历史失败，请重试";
        return null;
      }
      const data = res.data;
      if (!ownsRequest(revisionsRequest, id, requestSequence)) return null;
      revisions.value = (data.data || []) as DebateRevision[];
      return revisions.value;
    } catch (e) {
      if (!ownsRequest(revisionsRequest, id, requestSequence)) return null;
      error.value = "获取版本历史失败，请重试";
      reportError(e, "Failed to fetch revisions");
      return null;
    } finally {
      if (ownsRequest(revisionsRequest, id, requestSequence)) revisionsLoading.value = false;
    }
  };

  const fetchRevision = async (id: string, revisionID: string): Promise<DebateRevision | null> => {
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${id}/revisions/${revisionID}`);
      if (!res.ok) {
        error.value = "获取版本详情失败，请重试";
        return null;
      }
      const data = res.data;
      return data.data as DebateRevision;
    } catch (e) {
      error.value = "获取版本详情失败，请重试";
      reportError(e, "Failed to fetch revision");
      return null;
    }
  };

  const fetchRevisionDiff = async (
    id: string,
    revisionID: string,
    against: string,
  ): Promise<DebateRevisionDiff | null> => {
    error.value = null;
    try {
      const res = await apiRequestResult(
        `${api.url}/debate/topics/${id}/revisions/${revisionID}/diff?against=${encodeURIComponent(against)}`,
      );
      if (!res.ok) {
        error.value = "获取对比差异失败，请重试";
        return null;
      }
      const data = res.data;
      return data.data as DebateRevisionDiff;
    } catch (e) {
      error.value = "获取对比差异失败，请重试";
      reportError(e, "Failed to fetch revision diff");
      return null;
    }
  };

  const revertRevision = async (
    id: string,
    revisionID: string,
    payload: WikiConcurrencyPayload,
  ): Promise<Debate | null> => {
    const mutation = beginCurrentDebateMutation(id);
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${id}/revisions/${revisionID}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!mutation.isCurrent()) return null;
      if (!res.ok) {
        error.value = "回退版本失败，请重试";
        return null;
      }
      const data = res.data;
      if (!mutation.commit()) return null;
      currentDebate.value = data.data as Debate;
      return currentDebate.value;
    } catch (e) {
      if (!mutation.isCurrent()) return null;
      error.value = "回退版本失败，请重试";
      reportError(e, "Failed to revert revision");
      return null;
    }
  };

  const reconfirmReference = async (
    id: string,
    relationID: string,
    payload: WikiConcurrencyPayload,
  ): Promise<Debate | null> => {
    const mutation = beginCurrentDebateMutation(id);
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${id}/references/${relationID}/reconfirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!mutation.isCurrent()) return null;
      if (!res.ok) {
        error.value = "重新确认引用失败，请重试";
        return null;
      }
      const data = res.data;
      if (!mutation.commit()) return null;
      currentDebate.value = data.data as Debate;
      return currentDebate.value;
    } catch (e) {
      if (!mutation.isCurrent()) return null;
      error.value = "重新确认引用失败，请重试";
      reportError(e, "Failed to reconfirm reference");
      return null;
    }
  };

  const fetchVotes = async (id: string): Promise<DebateVoteSummary | null> => {
    const requestSequence = beginOwnedRequest(votesRequest, id);
    votesLoading.value = true;
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${id}/votes`, { headers: authHeaders() });
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      if (!res.ok) {
        error.value = "获取投票数据失败，请重试";
        return null;
      }
      const data = res.data;
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      voteSummary.value = data.data as DebateVoteSummary;
      return voteSummary.value;
    } catch (e) {
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      error.value = "获取投票数据失败，请重试";
      reportError(e, "Failed to fetch votes");
      return null;
    } finally {
      if (ownsRequest(votesRequest, id, requestSequence)) votesLoading.value = false;
    }
  };

  const setVote = async (id: string, direction: DebateVoteDirection): Promise<DebateVoteSummary | null> => {
    const requestSequence = beginOwnedRequest(votesRequest, id);
    votesLoading.value = true;
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${id}/vote`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ direction }),
      });
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      if (!res.ok) {
        error.value = "投票失败，请重试";
        return null;
      }
      const data = res.data;
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      voteSummary.value = data.data as DebateVoteSummary;
      return voteSummary.value;
    } catch (e) {
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      error.value = "投票失败，请重试";
      reportError(e, "Failed to set vote");
      return null;
    } finally {
      if (ownsRequest(votesRequest, id, requestSequence)) votesLoading.value = false;
    }
  };

  const removeVote = async (id: string): Promise<DebateVoteSummary | null> => {
    const requestSequence = beginOwnedRequest(votesRequest, id);
    votesLoading.value = true;
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${id}/vote`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      if (!res.ok) {
        error.value = "取消投票失败，请重试";
        return null;
      }
      const data = res.data;
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      voteSummary.value = data.data as DebateVoteSummary;
      return voteSummary.value;
    } catch (e) {
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      error.value = "取消投票失败，请重试";
      reportError(e, "Failed to remove vote");
      return null;
    } finally {
      if (ownsRequest(votesRequest, id, requestSequence)) votesLoading.value = false;
    }
  };

  const fetchConclusions = async (id: string): Promise<DebateConclusionEvent[] | null> => {
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${id}/conclusions`);
      if (!res.ok) {
        error.value = "获取结论记录失败，请重试";
        return null;
      }
      const data = res.data;
      return (data.data || []) as DebateConclusionEvent[];
    } catch (e) {
      error.value = "获取结论记录失败，请重试";
      reportError(e, "Failed to fetch conclusions");
      return null;
    }
  };

  const searchDebates = async (q: string, limit = 10): Promise<Debate[]> => {
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics?search=${encodeURIComponent(q.trim())}&page_size=${limit}`)
      if (res.ok) {
        const data = res.data
        return data.data || []
      }
      return []
    } catch (e) {
      reportError(e, 'Failed to search debates')
      return []
    }
  }

	const searchCitableDebates = async (q: string, excludeId = ''): Promise<Debate[]> => {
		try {
			const query = encodeURIComponent(q.trim())
			const res = await apiRequestResult(`${api.url}/debate/topics?search=${query}&status=active&page_size=10`)
			if (!res.ok) return []
			const payload = res.data
			return ((payload.data || []) as Debate[]).filter((candidate) => (
				candidate.id !== excludeId
				&& candidate.status !== 'archived'
				&& Boolean(candidate.current_conclusion_event_id)
				&& (candidate.conclusion_type === 'yes' || candidate.conclusion_type === 'no')
			))
		} catch (e) {
			reportError(e, 'Failed to search citable debates')
			return []
		}
	}

  const extractApiError = (res: { data?: unknown }, fallback: string): string => {
    const payload = res.data as { message?: unknown; error?: unknown } | undefined;
    if (payload?.error && typeof payload.error === "object") {
      const msg = (payload.error as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    if (typeof payload?.message === "string" && payload.message.trim()) return payload.message;
    return fallback;
  };

  const setEvidenceVote = async (id: string, rating: DebateEvidenceRating): Promise<DebateVoteSummary | null> => {
    const requestSequence = beginOwnedRequest(votesRequest, id);
    votesLoading.value = true;
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${id}/evidence-vote`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ rating }),
      });
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      if (!res.ok) {
        error.value = extractApiError(res, "证据评估失败，请重试");
        return null;
      }
      const data = res.data;
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      voteSummary.value = data.data as DebateVoteSummary;
      return voteSummary.value;
    } catch (e) {
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      error.value = "证据评估失败，请重试";
      reportError(e, "Failed to set evidence vote");
      return null;
    } finally {
      if (ownsRequest(votesRequest, id, requestSequence)) votesLoading.value = false;
    }
  };

  const removeEvidenceVote = async (id: string): Promise<DebateVoteSummary | null> => {
    const requestSequence = beginOwnedRequest(votesRequest, id);
    votesLoading.value = true;
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${id}/evidence-vote`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      if (!res.ok) {
        error.value = extractApiError(res, "取消证据评估失败，请重试");
        return null;
      }
      const data = res.data;
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      voteSummary.value = data.data as DebateVoteSummary;
      return voteSummary.value;
    } catch (e) {
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      error.value = "取消证据评估失败，请重试";
      reportError(e, "Failed to remove evidence vote");
      return null;
    } finally {
      if (ownsRequest(votesRequest, id, requestSequence)) votesLoading.value = false;
    }
  };

  const fetchEntries = async (debateId: string): Promise<DebateEntry[] | null> => {
    const requestSequence = beginOwnedRequest(entriesRequest, debateId);
    entriesLoading.value = true;
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${debateId}/entries`, { headers: authHeaders() });
      if (!ownsRequest(entriesRequest, debateId, requestSequence)) return null;
      if (!res.ok) {
        error.value = extractApiError(res, "获取结构化论据失败，请重试");
        return null;
      }
      const items = (res.data?.data || []) as DebateEntry[];
      if (!ownsRequest(entriesRequest, debateId, requestSequence)) return null;
      entries.value = items;
      return items;
    } catch (e) {
      if (!ownsRequest(entriesRequest, debateId, requestSequence)) return null;
      error.value = "获取结构化论据失败，请重试";
      reportError(e, "Failed to fetch debate entries");
      return null;
    } finally {
      if (ownsRequest(entriesRequest, debateId, requestSequence)) entriesLoading.value = false;
    }
  };

  const createEntry = async (debateId: string, input: CreateDebateEntryInput): Promise<DebateEntry | null> => {
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${debateId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        error.value = extractApiError(res, "提交论据失败，请重试");
        return null;
      }
      const created = res.data?.data as DebateEntry;
      if (entriesRequest.ownerID === debateId || currentDebate.value?.id === debateId) {
        entries.value = [...entries.value, created];
      }
      return created;
    } catch (e) {
      error.value = "提交论据失败，请重试";
      reportError(e, "Failed to create debate entry");
      return null;
    }
  };

  const updateEntry = async (debateId: string, entryId: string, input: UpdateDebateEntryInput): Promise<DebateEntry | null> => {
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${debateId}/entries/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        error.value = extractApiError(res, "更新论据失败，请重试");
        return null;
      }
      const updated = res.data?.data as DebateEntry;
      if (entriesRequest.ownerID === debateId || currentDebate.value?.id === debateId) {
        entries.value = entries.value.map((item) => (item.id === entryId ? updated : item));
      }
      return updated;
    } catch (e) {
      error.value = "更新论据失败，请重试";
      reportError(e, "Failed to update debate entry");
      return null;
    }
  };

  const deleteEntry = async (debateId: string, entryId: string): Promise<boolean> => {
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${debateId}/entries/${entryId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        error.value = extractApiError(res, "删除论据失败，请重试");
        return false;
      }
      if (entriesRequest.ownerID === debateId || currentDebate.value?.id === debateId) {
        const removedIds = new Set<string>([entryId]);
        for (const item of entries.value) {
          if (item.parent_id && removedIds.has(item.parent_id)) removedIds.add(item.id);
        }
        for (const item of entries.value) {
          if (item.parent_id && removedIds.has(item.parent_id)) removedIds.add(item.id);
        }
        entries.value = entries.value.filter((item) => !removedIds.has(item.id));
      }
      return true;
    } catch (e) {
      error.value = "删除论据失败，请重试";
      reportError(e, "Failed to delete debate entry");
      return false;
    }
  };

  const fetchChallenges = async (
    debateId: string,
    status?: "" | "open" | "resolved" | "upheld" | "dismissed",
  ): Promise<DebateChallenge[] | null> => {
    const requestSequence = beginOwnedRequest(challengesRequest, debateId);
    challengesLoading.value = true;
    error.value = null;
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await apiRequestResult(`${api.url}/debate/topics/${debateId}/challenges${query}`, { headers: authHeaders() });
      if (!ownsRequest(challengesRequest, debateId, requestSequence)) return null;
      if (!res.ok) {
        error.value = extractApiError(res, "获取质询列表失败，请重试");
        return null;
      }
      const items = (res.data?.data || []) as DebateChallenge[];
      if (!ownsRequest(challengesRequest, debateId, requestSequence)) return null;
      challenges.value = items;
      return items;
    } catch (e) {
      if (!ownsRequest(challengesRequest, debateId, requestSequence)) return null;
      error.value = "获取质询列表失败，请重试";
      reportError(e, "Failed to fetch debate challenges");
      return null;
    } finally {
      if (ownsRequest(challengesRequest, debateId, requestSequence)) challengesLoading.value = false;
    }
  };

  const createChallenge = async (debateId: string, input: CreateDebateChallengeInput): Promise<DebateChallenge | null> => {
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${debateId}/challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        error.value = extractApiError(res, "发起质询失败，请重试");
        return null;
      }
      const created = res.data?.data as DebateChallenge;
      if (challengesRequest.ownerID === debateId || currentDebate.value?.id === debateId) {
        challenges.value = [created, ...challenges.value];
      }
      return created;
    } catch (e) {
      error.value = "发起质询失败，请重试";
      reportError(e, "Failed to create challenge");
      return null;
    }
  };

  const voteChallenge = async (
    debateId: string,
    challengeId: string,
    decision: DebateChallengeVoteDecision,
  ): Promise<DebateChallenge | null> => {
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${debateId}/challenges/${challengeId}/vote`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        error.value = extractApiError(res, "质询投票失败，请重试");
        return null;
      }
      const updated = res.data?.data as DebateChallenge;
      if (challengesRequest.ownerID === debateId || currentDebate.value?.id === debateId) {
        challenges.value = challenges.value.map((item) => (item.id === challengeId ? updated : item));
      }
      return updated;
    } catch (e) {
      error.value = "质询投票失败，请重试";
      reportError(e, "Failed to vote challenge");
      return null;
    }
  };

  const removeChallengeVote = async (debateId: string, challengeId: string): Promise<DebateChallenge | null> => {
    error.value = null;
    try {
      const res = await apiRequestResult(`${api.url}/debate/topics/${debateId}/challenges/${challengeId}/vote`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        error.value = extractApiError(res, "取消质询投票失败，请重试");
        return null;
      }
      const updated = res.data?.data as DebateChallenge;
      if (challengesRequest.ownerID === debateId || currentDebate.value?.id === debateId) {
        challenges.value = challenges.value.map((item) => (item.id === challengeId ? updated : item));
      }
      return updated;
    } catch (e) {
      error.value = "取消质询投票失败，请重试";
      reportError(e, "Failed to remove challenge vote");
      return null;
    }
  };

  const resetStore = () => {
    debatesRequestSequence += 1;
    currentDebateLoadingSequence += 1;
    wikiSaveRequestSequence += 1;
    invalidateOwnedRequest(currentDebateRequest);
    invalidateOwnedRequest(revisionsRequest);
    invalidateOwnedRequest(votesRequest);
    invalidateOwnedRequest(relationGraphRequest);
    invalidateOwnedRequest(entriesRequest);
    invalidateOwnedRequest(challengesRequest);
    debates.value = [];
    debatesTotal.value = 0;
    debatesMeta.value = { page: 1, page_size: 20, total: 0, has_more: false };
    currentDebate.value = null;
		voteSummary.value = null;
		revisions.value = [];
		relationGraph.value = null;
    entries.value = [];
    challenges.value = [];
    loading.value = false;
    wikiSaving.value = false;
    revisionsLoading.value = false;
    votesLoading.value = false;
		relationLoading.value = false;
    entriesLoading.value = false;
    challengesLoading.value = false;
    error.value = null;
  };

  const pinia = getActivePinia();
  if (pinia) onScopeDispose(registerSessionReset(pinia, resetStore));

  return {
    debates,
    debatesTotal,
		debatesMeta,
    currentDebate,
		voteSummary,
		revisions,
		relationGraph,
		relationLoading,
    entries,
    entriesLoading,
    challenges,
    challengesLoading,
    loading,
		wikiSaving,
		revisionsLoading,
		votesLoading,
    error,
    fetchDebates,
    fetchDebate,
		saveWiki,
		fetchRevisions,
		fetchRevision,
		fetchRevisionDiff,
		revertRevision,
		reconfirmReference,
		fetchVotes,
		setVote,
		removeVote,
    setEvidenceVote,
    removeEvidenceVote,
		fetchConclusions,
		fetchRelationGraph,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    fetchChallenges,
    createChallenge,
    voteChallenge,
    removeChallengeVote,
    createDebate,
    searchDebates,
		searchCitableDebates,
    resetStore,
  }
})

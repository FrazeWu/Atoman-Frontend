import { ref } from "vue";
import { defineStore } from "pinia";
import type {
  Debate,
  DebateConclusionEvent,
  DebateGraph,
  DebateRevision,
  DebateRevisionDiff,
  DebateStatus,
  DebateVoteDirection,
  DebateVoteSummary,
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

      const res = await fetch(`${api.url}/debate/topics?${query}`);
      if (requestSequence !== debatesRequestSequence) return false;
      if (!res.ok) throw new Error(`Failed to fetch debates (${res.status})`);
      const data = await res.json();
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
      error.value = "Failed to fetch debates";
      console.error(e);
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
      const res = await fetch(`${api.url}/debate/topics/${id}`);
      if (!ownsRequest(currentDebateRequest, id, requestSequence)) return null;
      if (res.ok) {
        const data = await res.json();
        if (!ownsRequest(currentDebateRequest, id, requestSequence)) return null;
        currentDebate.value = data.data;
        return data.data as Debate;
      } else {
        error.value = "Debate not found";
        return null;
      }
    } catch (e) {
      if (!ownsRequest(currentDebateRequest, id, requestSequence)) return null;
      error.value = "Failed to fetch debate";
      console.error(e);
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
          const res = await fetch(url)
          if (!res.ok) return null
          const payload = await res.json()
          return payload.data as DebateGraph
        } catch (e) {
          console.error('Failed to fetch debate relation fragment', e)
          return null
        }
      }

      const requestSequence = beginOwnedRequest(relationGraphRequest, id)
      relationLoading.value = true
      error.value = null
      try {
        const res = await fetch(url)
        if (!ownsRequest(relationGraphRequest, id, requestSequence)) return null
        if (!res.ok) {
          error.value = 'Failed to fetch debate relations'
          return null
        }
        const payload = await res.json()
        if (!ownsRequest(relationGraphRequest, id, requestSequence)) return null
        relationGraph.value = payload.data as DebateGraph
        return relationGraph.value
      } catch (e) {
        if (!ownsRequest(relationGraphRequest, id, requestSequence)) return null
        error.value = 'Failed to fetch debate relations'
        console.error('Failed to fetch debate relations', e)
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
      const res = await fetch(`${api.url}/debate/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return data.data as Debate;
      } else {
        const responseError = await res.json().catch(() => ({}));
        error.value = referencePublishErrorMessage(responseError, "创建失败，请重试");
      }
    } catch (e) {
      error.value = referencePublishErrorMessage(e, "创建失败，请重试");
      console.error("Failed to create debate", e);
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
      const res = await fetch(`${api.url}/debate/topics/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const responsePayload = await res.json();
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
      console.error("Failed to save debate", e);
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
      const res = await fetch(`${api.url}/debate/topics/${id}/revisions`);
      if (!ownsRequest(revisionsRequest, id, requestSequence)) return null;
      if (!res.ok) {
        error.value = "Failed to fetch revisions";
        return null;
      }
      const data = await res.json();
      if (!ownsRequest(revisionsRequest, id, requestSequence)) return null;
      revisions.value = (data.data || []) as DebateRevision[];
      return revisions.value;
    } catch (e) {
      if (!ownsRequest(revisionsRequest, id, requestSequence)) return null;
      error.value = "Failed to fetch revisions";
      console.error("Failed to fetch revisions", e);
      return null;
    } finally {
      if (ownsRequest(revisionsRequest, id, requestSequence)) revisionsLoading.value = false;
    }
  };

  const fetchRevision = async (id: string, revisionID: string): Promise<DebateRevision | null> => {
    error.value = null;
    try {
      const res = await fetch(`${api.url}/debate/topics/${id}/revisions/${revisionID}`);
      if (!res.ok) {
        error.value = "Failed to fetch revision";
        return null;
      }
      const data = await res.json();
      return data.data as DebateRevision;
    } catch (e) {
      error.value = "Failed to fetch revision";
      console.error("Failed to fetch revision", e);
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
      const res = await fetch(
        `${api.url}/debate/topics/${id}/revisions/${revisionID}/diff?against=${encodeURIComponent(against)}`,
      );
      if (!res.ok) {
        error.value = "Failed to fetch revision diff";
        return null;
      }
      const data = await res.json();
      return data.data as DebateRevisionDiff;
    } catch (e) {
      error.value = "Failed to fetch revision diff";
      console.error("Failed to fetch revision diff", e);
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
      const res = await fetch(`${api.url}/debate/topics/${id}/revisions/${revisionID}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!mutation.isCurrent()) return null;
      if (!res.ok) {
        error.value = "Failed to revert revision";
        return null;
      }
      const data = await res.json();
      if (!mutation.commit()) return null;
      currentDebate.value = data.data as Debate;
      return currentDebate.value;
    } catch (e) {
      if (!mutation.isCurrent()) return null;
      error.value = "Failed to revert revision";
      console.error("Failed to revert revision", e);
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
      const res = await fetch(`${api.url}/debate/topics/${id}/references/${relationID}/reconfirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!mutation.isCurrent()) return null;
      if (!res.ok) {
        error.value = "Failed to reconfirm reference";
        return null;
      }
      const data = await res.json();
      if (!mutation.commit()) return null;
      currentDebate.value = data.data as Debate;
      return currentDebate.value;
    } catch (e) {
      if (!mutation.isCurrent()) return null;
      error.value = "Failed to reconfirm reference";
      console.error("Failed to reconfirm reference", e);
      return null;
    }
  };

  const fetchVotes = async (id: string): Promise<DebateVoteSummary | null> => {
    const requestSequence = beginOwnedRequest(votesRequest, id);
    votesLoading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${api.url}/debate/topics/${id}/votes`, { headers: authHeaders() });
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      if (!res.ok) {
        error.value = "Failed to fetch votes";
        return null;
      }
      const data = await res.json();
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      voteSummary.value = data.data as DebateVoteSummary;
      return voteSummary.value;
    } catch (e) {
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      error.value = "Failed to fetch votes";
      console.error("Failed to fetch votes", e);
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
      const res = await fetch(`${api.url}/debate/topics/${id}/vote`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ direction }),
      });
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      if (!res.ok) {
        error.value = "Failed to set vote";
        return null;
      }
      const data = await res.json();
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      voteSummary.value = data.data as DebateVoteSummary;
      return voteSummary.value;
    } catch (e) {
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      error.value = "Failed to set vote";
      console.error("Failed to set vote", e);
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
      const res = await fetch(`${api.url}/debate/topics/${id}/vote`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      if (!res.ok) {
        error.value = "Failed to remove vote";
        return null;
      }
      const data = await res.json();
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      voteSummary.value = data.data as DebateVoteSummary;
      return voteSummary.value;
    } catch (e) {
      if (!ownsRequest(votesRequest, id, requestSequence)) return null;
      error.value = "Failed to remove vote";
      console.error("Failed to remove vote", e);
      return null;
    } finally {
      if (ownsRequest(votesRequest, id, requestSequence)) votesLoading.value = false;
    }
  };

  const fetchConclusions = async (id: string): Promise<DebateConclusionEvent[] | null> => {
    error.value = null;
    try {
      const res = await fetch(`${api.url}/debate/topics/${id}/conclusions`);
      if (!res.ok) {
        error.value = "Failed to fetch conclusions";
        return null;
      }
      const data = await res.json();
      return (data.data || []) as DebateConclusionEvent[];
    } catch (e) {
      error.value = "Failed to fetch conclusions";
      console.error("Failed to fetch conclusions", e);
      return null;
    }
  };

  const searchDebates = async (q: string, limit = 10): Promise<Debate[]> => {
    try {
      const res = await fetch(`${api.url}/debate/topics?search=${encodeURIComponent(q.trim())}&page_size=${limit}`)
      if (res.ok) {
        const data = await res.json()
        return data.data || []
      }
      return []
    } catch (e) {
      console.error('Failed to search debates', e)
      return []
    }
  }

	const searchCitableDebates = async (q: string, excludeId = ''): Promise<Debate[]> => {
		try {
			const query = encodeURIComponent(q.trim())
			const res = await fetch(`${api.url}/debate/topics?search=${query}&status=active&page_size=10`)
			if (!res.ok) return []
			const payload = await res.json()
			return ((payload.data || []) as Debate[]).filter((candidate) => (
				candidate.id !== excludeId
				&& candidate.status !== 'archived'
				&& Boolean(candidate.current_conclusion_event_id)
				&& (candidate.conclusion_type === 'yes' || candidate.conclusion_type === 'no')
			))
		} catch (e) {
			console.error('Failed to search citable debates', e)
			return []
		}
	}

  const resetStore = () => {
    debatesRequestSequence += 1;
    currentDebateLoadingSequence += 1;
    wikiSaveRequestSequence += 1;
    invalidateOwnedRequest(currentDebateRequest);
    invalidateOwnedRequest(revisionsRequest);
    invalidateOwnedRequest(votesRequest);
    invalidateOwnedRequest(relationGraphRequest);
    debates.value = [];
    debatesTotal.value = 0;
    debatesMeta.value = { page: 1, page_size: 20, total: 0, has_more: false };
    currentDebate.value = null;
		voteSummary.value = null;
		revisions.value = [];
		relationGraph.value = null;
    loading.value = false;
    wikiSaving.value = false;
    revisionsLoading.value = false;
    votesLoading.value = false;
		relationLoading.value = false;
    error.value = null;
  };

  return {
    debates,
    debatesTotal,
		debatesMeta,
    currentDebate,
		voteSummary,
		revisions,
		relationGraph,
		relationLoading,
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
		fetchConclusions,
		fetchRelationGraph,
    createDebate,
    searchDebates,
		searchCitableDebates,
    resetStore,
  }
})

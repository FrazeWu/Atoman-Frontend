import { ref } from "vue";
import { defineStore } from "pinia";
import type { Debate, Argument, DebateGraph, DebateRelation, DebateRelationStance, DebateVote } from "@/types";
import { useAuthStore } from "@/stores/auth";
import { useApi } from '@/composables/useApi'

const api = useApi();

export const useDebateStore = defineStore("debate", () => {
  const debates = ref<Debate[]>([]);
  const debatesTotal = ref(0);
  const currentDebate = ref<Debate | null>(null);
  const argumentList = ref<Argument[]>([]);
	const relationGraph = ref<DebateGraph | null>(null);
	const relationLoading = ref(false);
	const argumentsPage = ref(0);
	const argumentsHasMore = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);
  // Track current user's votes on arguments
  const userVotes = ref<Record<string, number>>({});
  let debatesRequestSequence = 0;

  const authHeaders = () => {
    const authStore = useAuthStore();
    return { Authorization: `Bearer ${authStore.token}` };
  };

  const fetchDebates = async (
    params: {
      status?: "open" | "concluded" | "archived";
      tag?: string;
      page?: number;
      limit?: number;
    } = {},
  ) => {
    const requestSequence = ++debatesRequestSequence;
    loading.value = true;
    error.value = null;
    try {
      const query = new URLSearchParams();
      if (params.status) query.set("status", params.status);
      if (params.tag) query.set("tag", params.tag);
      if (params.page) query.set("page", String(params.page));
      if (params.limit) query.set("limit", String(params.limit));

      const res = await fetch(`${api.url}/debate/topics?${query}`);
      if (requestSequence !== debatesRequestSequence) return false;
      if (!res.ok) throw new Error(`Failed to fetch debates (${res.status})`);
      const data = await res.json();
      if (requestSequence !== debatesRequestSequence) return false;
      const rows = data.data || [];
      debates.value = (params.page || 1) > 1 ? [...debates.value, ...rows] : rows;
      debatesTotal.value = data.meta?.total || 0;
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
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${api.url}/debate/topics/${id}`);
      if (res.ok) {
        const data = await res.json();
        currentDebate.value = data.data;
        return data.data as Debate;
      } else {
        error.value = "Debate not found";
        return null;
      }
    } catch (e) {
      error.value = "Failed to fetch debate";
      console.error(e);
      return null;
    } finally {
      loading.value = false;
    }
  };

	const fetchRelationGraph = async (id: string, view: 'tree' | 'graph' = 'tree'): Promise<DebateGraph | null> => {
		relationLoading.value = true
		try {
			const res = await fetch(`${api.url}/debates/${id}/relations?view=${view}`)
			if (!res.ok) return null
			const payload = await res.json()
			relationGraph.value = payload.data as DebateGraph
			return relationGraph.value
		} catch (e) {
			console.error('Failed to fetch debate relations', e)
			return null
		} finally {
			relationLoading.value = false
		}
	}

	const createRelation = async (
		sourceDebateId: string,
		targetDebateId: string,
		stance: DebateRelationStance,
	): Promise<DebateRelation | null> => {
		try {
			const res = await fetch(`${api.url}/debate-relations`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...authHeaders() },
				body: JSON.stringify({
					source_debate_id: sourceDebateId,
					target_debate_id: targetDebateId,
					stance,
				}),
			})
			if (!res.ok) return null
			const payload = await res.json()
			return payload.data as DebateRelation
		} catch (e) {
			console.error('Failed to create debate relation', e)
			return null
		}
	}

	const deleteRelation = async (relationId: string): Promise<boolean> => {
		try {
			const res = await fetch(`${api.url}/debate-relations/${relationId}`, {
				method: 'DELETE',
				headers: authHeaders(),
			})
			return res.ok
		} catch (e) {
			console.error('Failed to delete debate relation', e)
			return false
		}
	}

  const fetchArguments = async (debateId: string, options: { page?: number; reset?: boolean } = {}) => {
	const requestedPage = options.page ?? (options.reset === false ? argumentsPage.value + 1 : 1)
	const reset = options.reset !== false
    loading.value = true;
    error.value = null;
    try {
      const authStore = useAuthStore();
      const res = await fetch(`${api.url}/debates/${debateId}/arguments?page=${requestedPage}&page_size=20`, {
        headers: authStore.isAuthenticated ? authHeaders() : {},
      });
      if (res.ok) {
        const data = await res.json();
		const incoming = (data.data || []) as Argument[]
		if (reset) argumentList.value = incoming
		else {
		  const seen = new Set(argumentList.value.map(({ id }) => id))
		  argumentList.value = [...argumentList.value, ...incoming.filter(({ id }) => !seen.has(id))]
		}
		argumentsPage.value = data.meta?.page ?? requestedPage
		argumentsHasMore.value = Boolean(data.meta?.has_more)
		userVotes.value = data.meta?.user_votes || {};
        return data.data as Argument[];
      } else {
        error.value = "Failed to fetch arguments";
        userVotes.value = {};
        return [];
      }
    } catch (e) {
      error.value = "Failed to fetch arguments";
      console.error(e);
      userVotes.value = {};
      return [];
    } finally {
      loading.value = false;
    }
  };

  const createDebate = async (payload: {
    title: string;
    description: string;
    content: string;
    tags: string[];
  }): Promise<Debate | null> => {
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
        const error = await res.json();
        throw new Error(error.error || "Failed to create debate");
      }
    } catch (e) {
      console.error("Failed to create debate", e);
      return null;
    }
  };

  const updateDebate = async (
    id: string,
    payload: {
      title: string;
      description: string;
      content: string;
      tags: string[];
    },
  ): Promise<Debate | null> => {
    try {
      const res = await fetch(`${api.url}/debate/topics/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return data.data as Debate;
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to update debate");
      }
    } catch (e) {
      console.error("Failed to update debate", e);
      return null;
    }
  };

  const deleteDebate = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${api.url}/debate/topics/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error("Failed to delete debate", e);
      return false;
    }
  };

  const concludeDebate = async (
    id: string,
    payload: { conclusion_type: 'yes' | 'no'; conclusion_summary?: string },
  ): Promise<Debate | null> => {
    try {
      const res = await fetch(`${api.url}/debate/topics/${id}/conclude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        return data.data as Debate
      } else {
        const error = await res.json()
        throw new Error(error.error || 'Failed to conclude debate')
      }
    } catch (e) {
      console.error('Failed to conclude debate', e)
      return null
    }
  }

  const reopenDebate = async (id: string): Promise<Debate | null> => {
    try {
      const res = await fetch(`${api.url}/debate/topics/${id}/reopen`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        return data.data as Debate
      } else {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reopen debate')
      }
    } catch (e) {
      console.error('Failed to reopen debate', e)
      return null
    }
  }

  const voteToConclude = async (
    id: string,
  ): Promise<{ conclude_vote_count: number; conclude_threshold: number; auto_concluded: boolean } | null> => {
    try {
      const res = await fetch(`${api.url}/debates/${id}/conclusion-vote`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        return data.data
      } else {
        const error = await res.json()
        throw new Error(error.error || 'Failed to vote to conclude')
      }
    } catch (e) {
      console.error('Failed to vote to conclude', e)
      return null
    }
  }

  const searchDebates = async (q: string, limit = 10): Promise<Debate[]> => {
    try {
      const res = await fetch(`${api.url}/debate/topics/search?q=${encodeURIComponent(q)}&limit=${limit}`)
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
			const res = await fetch(`${api.url}/debate/topics/search?q=${query}&status=concluded&limit=10`)
			if (!res.ok) return []
			const payload = await res.json()
			return ((payload.data || []) as Debate[]).filter((candidate) => (
				candidate.id !== excludeId
				&& candidate.status === 'concluded'
				&& (candidate.conclusion_type === 'yes' || candidate.conclusion_type === 'no')
			))
		} catch (e) {
			console.error('Failed to search citable debates', e)
			return []
		}
	}

  const addDebateReference = async (argumentId: string, debateId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${api.url}/debate-arguments/${argumentId}/debate-reference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ debate_id: debateId }),
      })
      return res.ok
    } catch (e) {
      console.error('Failed to add debate reference', e)
      return false
    }
  }

  const removeDebateReference = async (argumentId: string, debateId: string): Promise<boolean> => {
    try {
      const res = await fetch(
        `${api.url}/debate-arguments/${argumentId}/debate-reference/${debateId}`,
        {
          method: 'DELETE',
          headers: authHeaders(),
        },
      )
      return res.ok
    } catch (e) {
      console.error('Failed to remove debate reference', e)
      return false
    }
  }

  const createArgument = async (
    debateId: string,
    payload: {
      content: string;
      argument_type:
        | "support"
        | "oppose"
        | "neutral"
        | "evidence"
        | "question"
        | "counter";
      parent_id?: string;
      mentions?: Array<{ user_id: string; start: number; end: number }>;
      attachment_ids?: string[];
    },
  ): Promise<Argument | null> => {
    try {
      const res = await fetch(
        `${api.url}/debates/${debateId}/arguments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const error = await res.json();
        console.error("Create argument error:", error);
        throw new Error(error.error || "Failed to create argument");
      }
      const data = await res.json();
      return data.data as Argument;
    } catch (e) {
      console.error("Failed to create argument", e);
      throw e;
    }
  };

  const updateArgument = async (
    id: string,
    payload: {
      content: string;
      argument_type:
        | "support"
        | "oppose"
        | "neutral"
        | "evidence"
        | "question"
        | "counter";
      source_url?: string;
      source_title?: string;
      source_excerpt?: string;
      mentions?: Array<{ user_id: string; start: number; end: number }>;
      attachment_ids?: string[];
    },
  ): Promise<Argument | null> => {
    try {
      const res = await fetch(`${api.url}/debate-arguments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return data.data as Argument;
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to update argument");
      }
    } catch (e) {
      console.error("Failed to update argument", e);
      return null;
    }
  };

  const deleteArgument = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${api.url}/debate-arguments/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error("Failed to delete argument", e);
      return false;
    }
  };

  const voteArgument = async (
    argumentId: string,
    voteType: number,
  ): Promise<DebateVote | null> => {
    try {
      const res = await fetch(
        `${api.url}/debate-arguments/${argumentId}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ vote_type: voteType }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        // Track user vote locally
        userVotes.value[argumentId] = voteType;
        return data.data as DebateVote;
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to vote");
      }
    } catch (e) {
      console.error("Failed to vote", e);
      return null;
    }
  };

  const removeVote = async (argumentId: string): Promise<boolean> => {
    try {
      const res = await fetch(
        `${api.url}/debate-arguments/${argumentId}/vote`,
        {
          method: "DELETE",
          headers: authHeaders(),
        },
      );
      if (res.ok) {
        // Remove vote locally
        delete userVotes.value[argumentId];
      }
      return res.ok;
    } catch (e) {
      console.error("Failed to remove vote", e);
      return false;
    }
  };

  const addArgumentReference = async (
    argumentId: string,
    referenceId: string,
  ): Promise<boolean> => {
    try {
      const res = await fetch(
        `${api.url}/debate-arguments/${argumentId}/reference`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ reference_id: referenceId }),
        },
      );
      return res.ok;
    } catch (e) {
      console.error("Failed to add reference", e);
      return false;
    }
  };

  const removeArgumentReference = async (
    argumentId: string,
    referenceId: string,
  ): Promise<boolean> => {
    try {
      const res = await fetch(
        `${api.url}/debate-arguments/${argumentId}/reference/${referenceId}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        },
      );
      return res.ok;
    } catch (e) {
      console.error("Failed to remove reference", e);
      return false;
    }
  };

  const resetStore = () => {
    debatesRequestSequence += 1;
    debates.value = [];
    debatesTotal.value = 0;
    currentDebate.value = null;
		relationGraph.value = null;
    argumentList.value = [];
	argumentsPage.value = 0;
	argumentsHasMore.value = false;
    userVotes.value = {};
    loading.value = false;
    error.value = null;
  };

  return {
    debates,
    debatesTotal,
    currentDebate,
		relationGraph,
		relationLoading,
    argumentList,
	argumentsPage,
	argumentsHasMore,
    loading,
    error,
    userVotes,
    fetchDebates,
    fetchDebate,
		fetchRelationGraph,
		createRelation,
		deleteRelation,
    fetchArguments,
    createDebate,
    updateDebate,
    deleteDebate,
    concludeDebate,
    reopenDebate,
    voteToConclude,
    searchDebates,
		searchCitableDebates,
    createArgument,
    updateArgument,
    deleteArgument,
    voteArgument,
    removeVote,
    addArgumentReference,
    removeArgumentReference,
    addDebateReference,
    removeDebateReference,
    resetStore,
  }
})

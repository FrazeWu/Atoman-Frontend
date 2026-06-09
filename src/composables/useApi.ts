export function useApiUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim()
  const baseUrl = configuredUrl || '/api'

  return baseUrl.replace(/\/$/, '')
}

export function useApi() {
  const apiUrl = useApiUrl();

  return {
    url: apiUrl,
    v1: {
      url: '/api/v1',
      uploads: '/api/v1/uploads',
      music: {
        artists: '/api/v1/music/artists',
        artist: (id: string) => `/api/v1/music/artists/${id}`,
        albums: '/api/v1/music/albums',
        album: (id: string) => `/api/v1/music/albums/${id}`,
        songs: '/api/v1/music/songs',
        song: (id: string) => `/api/v1/music/songs/${id}`,
        edits: '/api/v1/music/edits',
        edit: (id: string) => `/api/v1/music/edits/${id}`,
      },
    },
    songs: `${apiUrl}/songs`,
    song: (id: number | string) => `${apiUrl}/songs/${id}`,
    albums: `${apiUrl}/albums`,
    album: (id: number | string) => `${apiUrl}/albums/${id}`,
    artists: `${apiUrl}/artists`,
    corrections: `${apiUrl}/corrections`,

    music: {
      albums: `${apiUrl}/albums`,
      album: (id: number | string) => `${apiUrl}/albums/${id}`,
      albumRevisions: (id: number | string) => `${apiUrl}/albums/${id}/revisions`,
      albumRevision: (id: number | string, version: number | string) => `${apiUrl}/albums/${id}/revisions/${version}`,
      albumRevisionDiff: (id: number | string) => `${apiUrl}/albums/${id}/revisions/diff`,
      albumRevert: (id: number | string, version: number | string) => `${apiUrl}/albums/${id}/revisions/${version}/revert`,
      albumDiscussions: (id: number | string) => `${apiUrl}/albums/${id}/discussions`,
      albumEntryStatus: (id: number | string) => `${apiUrl}/albums/${id}/entry-status`,
      albumProtection: (id: number | string) => `${apiUrl}/albums/${id}/protection`,
      artists: `${apiUrl}/artists`,
      artist: (id: number | string) => `${apiUrl}/artists/${id}`,
      artistRevisions: (id: number | string) => `${apiUrl}/artists/${id}/revisions`,
      artistAliases: (id: number | string) => `${apiUrl}/artists/${id}/aliases`,
      artistEntryStatus: (id: number | string) => `${apiUrl}/artists/${id}/entry-status`,
      artistDiscussions: (id: number | string) => `${apiUrl}/artists/${id}/discussions`,
      songAnnotations: (id: number | string) => `${apiUrl}/songs/${id}/annotations`,
      adminMusicReview: `${apiUrl}/admin/music/entries`,
      adminMusicConfirm: (id: number | string, type: 'album' | 'artist') =>
        type === 'album' ? `${apiUrl}/albums/${id}/entry-status` : `${apiUrl}/artists/${id}/entry-status`,
    },
    
    blog: {
      channels: `${apiUrl}/blog/channels`,
      channel: (id: number | string) => `${apiUrl}/blog/channels/${id}`,
      channelEnsureDefault: `${apiUrl}/blog/channels/ensure-default`,
      channelCollections: (id: number | string) => `${apiUrl}/blog/channels/${id}/collections`,
      channelBySlug: (slug: string) => `${apiUrl}/blog/channels/slug/${slug}`,
      channelCollectionsBySlug: (slug: string) => `${apiUrl}/blog/channels/slug/${slug}/collections`,
      collections: `${apiUrl}/blog/collections`,
      collection: (id: number | string) => `${apiUrl}/blog/collections/${id}`,
      
      posts: `${apiUrl}/blog/posts`,
      post: (id: number | string) => `${apiUrl}/blog/posts/${id}`,
      postPublish: (id: number | string) => `${apiUrl}/blog/posts/${id}/publish`,
      postUnpublish: (id: number | string) => `${apiUrl}/blog/posts/${id}/unpublish`,
      postPin: (id: number | string) => `${apiUrl}/blog/posts/${id}/pin`,
      postUnpin: (id: number | string) => `${apiUrl}/blog/posts/${id}/unpin`,
      draft: `${apiUrl}/blog/drafts`,
      drafts: `${apiUrl}/blog/posts/drafts`,
      postCollections: (id: number | string) => `${apiUrl}/blog/posts/${id}/collections`,
      postCollection: (id: number | string, collectionId: number | string) => `${apiUrl}/blog/posts/${id}/collections/${collectionId}`,
      uploadImage: `${apiUrl}/blog/upload-image`,
      
      comments: `${apiUrl}/blog/comments`,
      postComments: (id: number | string) => `${apiUrl}/blog/posts/${id}/comments`,
      
      likes: `${apiUrl}/blog/likes`,
      postLikesCount: (id: number | string) => `${apiUrl}/blog/posts/${id}/likes/count`,
      
      explore: `${apiUrl}/blog/explore`,
      bookmarkFolders: `${apiUrl}/blog/bookmark-folders`,
      bookmarkFolder: (id: number | string) => `${apiUrl}/blog/bookmark-folders/${id}`,
      bookmarks: `${apiUrl}/blog/bookmarks`,
    },
    
    auth: {
      register: `${apiUrl}/auth/register`,
      login: `${apiUrl}/auth/login`,
      session: `${apiUrl}/auth/session`,
      sendVerification: `${apiUrl}/auth/send-verification`,
      verifyEmail: `${apiUrl}/auth/verify-email`,
      onboardingComplete: `${apiUrl}/auth/onboarding/complete`,
    },

    settings: {
      publicSiteAccess: `${apiUrl}/settings/public/site-access`,
      siteAccess: `${apiUrl}/settings/site-access`,
    },

    admin: {
      siteAccess: `${apiUrl}/admin/site-access`,
      feed: {
        sources: `${apiUrl}/admin/feed/sources`,
        source: (sourceId: number | string) => `${apiUrl}/admin/feed/sources/${sourceId}`,
      },
      feedFulltext: {
        health: `${apiUrl}/admin/feed/fulltext/health`,
        settings: `${apiUrl}/admin/feed/fulltext/settings`,
        sources: `${apiUrl}/admin/feed/fulltext/sources`,
        source: (sourceId: number | string) => `${apiUrl}/admin/feed/fulltext/sources/${sourceId}`,
        items: `${apiUrl}/admin/feed/fulltext/items`,
        sourceSettings: (sourceId: number | string) => `${apiUrl}/admin/feed/fulltext/sources/${sourceId}/settings`,
        syncSource: (sourceId: number | string) => `${apiUrl}/admin/feed/fulltext/sources/${sourceId}/sync`,
        retryItem: (itemId: number | string) => `${apiUrl}/admin/feed/fulltext/items/${itemId}/retry`,
      },
      reviews: {
        songs: `${apiUrl}/admin/reviews/songs`,
        approveSong: (id: number | string) => `${apiUrl}/admin/reviews/songs/${id}/approve`,
        rejectSong: (id: number | string) => `${apiUrl}/admin/reviews/songs/${id}/reject`,
        songCorrections: `${apiUrl}/admin/reviews/song-corrections`,
        approveSongCorrection: (id: number | string) => `${apiUrl}/admin/reviews/song-corrections/${id}/approve`,
        rejectSongCorrection: (id: number | string) => `${apiUrl}/admin/reviews/song-corrections/${id}/reject`,
        albums: `${apiUrl}/admin/reviews/albums`,
        approveAlbum: (id: number | string) => `${apiUrl}/admin/reviews/albums/${id}/approve`,
        rejectAlbum: (id: number | string) => `${apiUrl}/admin/reviews/albums/${id}/reject`,
        albumCorrections: `${apiUrl}/admin/reviews/album-corrections`,
        approveAlbumCorrection: (id: number | string) => `${apiUrl}/admin/reviews/album-corrections/${id}/approve`,
        rejectAlbumCorrection: (id: number | string) => `${apiUrl}/admin/reviews/album-corrections/${id}/reject`,
        artistCorrections: `${apiUrl}/admin/reviews/artist-corrections`,
        approveArtistCorrection: (id: number | string) => `${apiUrl}/admin/reviews/artist-corrections/${id}/approve`,
        rejectArtistCorrection: (id: number | string) => `${apiUrl}/admin/reviews/artist-corrections/${id}/reject`,
      },
    },

    site: {
      access: `${apiUrl}/site/access`,
    },
    
    users: {
      search: `${apiUrl}/users/search`,
      me: `${apiUrl}/users/me`,
      settings: `${apiUrl}/users/me`,          // profile update (display_name, bio, etc)
      meSettings: `${apiUrl}/users/me/settings`,
      profile: (username: string) => `${apiUrl}/users/by-username/${username}`,
      roles: `${apiUrl}/users/roles`,
      role: (userUuid: string) => `${apiUrl}/users/${userUuid}/role`,
      follow: (userUuid: string) => `${apiUrl}/users/${userUuid}/follow`,
      followers: (userUuid: string) => `${apiUrl}/users/${userUuid}/followers`,
      following: (userUuid: string) => `${apiUrl}/users/${userUuid}/following`,
    },
    
    feed: {
      subscriptions: `${apiUrl}/feed/subscriptions`,
      subscription: (id: number) => `${apiUrl}/feed/subscriptions/${id}`,
      timeline: `${apiUrl}/feed/timeline`,
      explore: `${apiUrl}/feed/explore`,
      rss: (username: string) => `${apiUrl}/feed/rss/${username}`,
    },

    notifications: {
      list: `${apiUrl}/notifications`,
      unreadCount: `${apiUrl}/notifications/unread-count`,
      markRead: (id: string) => `${apiUrl}/notifications/${id}/read`,
      markAllRead: `${apiUrl}/notifications/read-all`,
    },

    dm: {
      conversations: `${apiUrl}/dm/conversations`,
      conversation: (username: string) => `${apiUrl}/dm/conversations/${username}`,
      markRead: (username: string) => `${apiUrl}/dm/conversations/${username}/read`,
      unreadCount: `${apiUrl}/dm/unread-count`,
      upload: `${apiUrl}/dm/upload`,
    },

    videos: {
      list: `${apiUrl}/videos`,
      create: `${apiUrl}/videos`,
      get: (id: string) => `${apiUrl}/videos/${id}`,
      update: (id: string) => `${apiUrl}/videos/${id}`,
      delete: (id: string) => `${apiUrl}/videos/${id}`,
      uploadVideo: `${apiUrl}/videos/upload-video`,
      uploadCover: `${apiUrl}/videos/upload-cover`,
      incrementView: (id: string) => `${apiUrl}/videos/${id}/view`,
      recommended: (id: string) => `${apiUrl}/videos/${id}/recommended`,
      comments: (id: string) => `${apiUrl}/videos/${id}/comments`,
      comment: (commentId: string) => `${apiUrl}/videos/comments/${commentId}`,
    },

    podcast: {
      episodes: `${apiUrl}/podcast/episodes`,
      episode: (id: string) => `${apiUrl}/podcast/episodes/${id}`,
      showEpisodes: (channelSlug: string) => `${apiUrl}/podcast/shows/${channelSlug}/episodes`,
      uploadAudio: `${apiUrl}/podcast/upload-audio`,
      uploadCover: `${apiUrl}/podcast/upload-cover`,
    },

  };
}

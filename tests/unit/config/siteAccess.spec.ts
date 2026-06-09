import { describe, expect, it } from 'vitest'
import {
  defaultSiteAccess,
  getBlogCommentMode,
  getFeedFullTextMode,
  isForumCategoryRequestEnabled,
  getVisibleModuleKeys,
  isModuleFeatureEnabled,
  mergeSiteAccess,
} from '@/config/siteAccess'

describe('site access config', () => {
  it('defaults every module and feature to enabled', () => {
    const access = mergeSiteAccess(null)

    expect(getVisibleModuleKeys(access)).toEqual(['feed', 'kanbo', 'music', 'forum', 'debate', 'timeline'])
    expect(access.modules.kanbo.enabled).toBe(true)
    expect(isModuleFeatureEnabled(access, 'blog', 'post.create')).toBe(true)
    expect(isModuleFeatureEnabled(access, 'podcast', 'podcast.publish')).toBe(true)
    expect(isModuleFeatureEnabled(access, 'video', 'video.publish')).toBe(true)
  })

  it('merges partial settings without losing default module feature keys', () => {
    const access = mergeSiteAccess({
      version: 1,
      modules: {
        blog: {
          enabled: true,
          features: {
            'post.create': false,
          },
        },
      },
    })

    expect(access.version).toBe(1)
    expect(access.modules.blog.enabled).toBe(true)
    expect(isModuleFeatureEnabled(access, 'blog', 'post.create')).toBe(false)
    expect(isModuleFeatureEnabled(access, 'blog', 'channel.manage')).toBe(defaultSiteAccess.modules.blog.features['channel.manage'])
  })

  it('accepts legacy visible payloads', () => {
    const access = mergeSiteAccess({
      modules: {
        music: {
          visible: false,
          features: {
            'music.submit': false,
          },
        },
      },
    })

    expect(access.modules.music.enabled).toBe(false)
    expect(isModuleFeatureEnabled(access, 'music', 'music.submit')).toBe(false)
  })

  it('hides disabled modules from module navigation', () => {
    const access = mergeSiteAccess({
      modules: {
        forum: { enabled: false, features: {} },
      },
    })

    expect(getVisibleModuleKeys(access)).not.toContain('forum')
    expect(isModuleFeatureEnabled(access, 'forum', 'topic.create')).toBe(false)
  })

  it('provides structured defaults for feed blog and forum settings', () => {
    const access = mergeSiteAccess(null)

    expect(getFeedFullTextMode(access)).toBe('per_source')
    expect(getBlogCommentMode(access)).toBe('authenticated')
    expect(isForumCategoryRequestEnabled(access)).toBe(true)
    expect(access.settings.forum.moderator_permissions.review_category_request).toBe(true)
    expect(access.settings.forum.moderator_permissions.pin_topic).toBe(true)
    expect(access.settings.forum.moderator_permissions.lock_topic).toBe(true)
  })
})

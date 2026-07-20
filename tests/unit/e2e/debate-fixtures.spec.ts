import { describe, expect, it } from 'vitest'

import { assertLocalDockerEndpoint } from '../../e2e/helpers/debate-fixtures'

describe('debate E2E Docker guard', () => {
  it('accepts a local Unix socket endpoint', () => {
    expect(() => assertLocalDockerEndpoint('unix:///var/run/docker.sock')).not.toThrow()
  })

  it.each([
    'tcp://127.0.0.1:2375',
    'tcp://192.0.2.10:2376',
    'ssh://developer@example.test',
    '',
  ])('rejects a non-Unix Docker endpoint: %s', (endpoint) => {
    expect(() => assertLocalDockerEndpoint(endpoint)).toThrow('拒绝对非本机 Docker daemon 执行数据库 fixture')
  })
})

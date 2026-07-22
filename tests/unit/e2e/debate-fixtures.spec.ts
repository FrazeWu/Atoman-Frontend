import { afterEach, describe, expect, it, vi } from 'vitest'

import { assertLocalDockerEndpoint, buildLocalPsqlArgs } from '../../e2e/helpers/debate-fixtures'

afterEach(() => {
  vi.unstubAllEnvs()
})

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

  it('forces psql through the PostgreSQL Unix socket', () => {
    vi.stubEnv('DEBATE_E2E_POSTGRES_CONTAINER', 'custom-postgres')
    vi.stubEnv('DEBATE_E2E_POSTGRES_USER', 'custom-user')
    vi.stubEnv('DEBATE_E2E_POSTGRES_DB', 'custom-db')
    vi.stubEnv('PGHOST', 'remote.example.test')
    vi.stubEnv('PGSERVICE', 'remote-service')

    expect(buildLocalPsqlArgs('SELECT 1;')).toEqual([
      'exec', 'custom-postgres',
      'psql', '-q',
      '-h', '/var/run/postgresql',
      '-U', 'custom-user',
      '-d', 'custom-db',
      '-v', 'ON_ERROR_STOP=1',
      '-At', '-c', 'SELECT 1;',
    ])
  })
})

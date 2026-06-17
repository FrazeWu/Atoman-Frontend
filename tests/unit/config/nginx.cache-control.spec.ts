import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const backendRoot = path.resolve(process.cwd(), '../Atoman-Backend')
const nginxPath = path.join(backendRoot, 'nginx/conf.d/default.conf')
const dockerProxyPath = path.join(backendRoot, 'nginx/conf.d/docker.atoman.org.conf')
const realIpPath = path.join(backendRoot, 'nginx/conf.d/00-real-ip.conf')
const legacySslPath = path.join(backendRoot, 'nginx/nginx-ssl.conf')
const frontendDockerfilePath = path.resolve(process.cwd(), 'Dockerfile')
const frontendDockerignorePath = path.resolve(process.cwd(), '.dockerignore')
const backendDockerignorePath = path.join(backendRoot, '.dockerignore')

const requiredPaths = [
  nginxPath,
  dockerProxyPath,
  realIpPath,
  legacySslPath,
  frontendDockerfilePath,
  frontendDockerignorePath,
  backendDockerignorePath,
]
const describeIfConfigExists = requiredPaths.every(existsSync) ? describe : describe.skip

describeIfConfigExists('production nginx cache control', () => {
  const nginxSource = readFileSync(nginxPath, 'utf8')
  const dockerProxySource = readFileSync(dockerProxyPath, 'utf8')
  const realIpSource = readFileSync(realIpPath, 'utf8')
  const legacySslSource = readFileSync(legacySslPath, 'utf8')
  const frontendDockerfile = readFileSync(frontendDockerfilePath, 'utf8')
  const frontendDockerignore = readFileSync(frontendDockerignorePath, 'utf8')
  const backendDockerignore = readFileSync(backendDockerignorePath, 'utf8')

  it('keeps SPA html revalidated while preserving immutable asset caching', () => {
    expect(nginxSource).toContain('location = /index.html')
    expect(nginxSource).toContain('Cache-Control "no-cache, no-store, must-revalidate"')
    expect(nginxSource).toContain('Pragma "no-cache"')
    expect(nginxSource).toContain('Expires "0"')
    expect(nginxSource).toContain('Cache-Control "public, immutable"')
  })

  it('ensures built static assets are readable by the nginx worker user', () => {
    expect(frontendDockerfile).toContain('chmod -R a+rX /usr/share/nginx/html')
  })

  it('keeps production Docker build contexts free of local secrets and generated output', () => {
    expect(backendDockerignore).toMatch(/^\.env\.\*$/m)
    expect(backendDockerignore).toMatch(/^!\.env\.example$/m)
    expect(backendDockerignore).toMatch(/^nginx\/ssl$/m)
    expect(backendDockerignore).toMatch(/^\.git$/m)

    expect(frontendDockerignore).toMatch(/^\.env\.\*$/m)
    expect(frontendDockerignore).toMatch(/^!\.env\.example$/m)
    expect(frontendDockerignore).toMatch(/^node_modules$/m)
    expect(frontendDockerignore).toMatch(/^dist$/m)
    expect(frontendDockerignore).toMatch(/^\.git$/m)
  })

  it('trusts the full current Cloudflare edge IP range set at nginx http scope', () => {
    const cloudflareIpv4Ranges = [
      '173.245.48.0/20',
      '103.21.244.0/22',
      '103.22.200.0/22',
      '103.31.4.0/22',
      '141.101.64.0/18',
      '108.162.192.0/18',
      '190.93.240.0/20',
      '188.114.96.0/20',
      '197.234.240.0/22',
      '198.41.128.0/17',
      '162.158.0.0/15',
      '104.16.0.0/13',
      '104.24.0.0/14',
      '172.64.0.0/13',
      '131.0.72.0/22',
    ]
    const cloudflareIpv6Ranges = [
      '2400:cb00::/32',
      '2606:4700::/32',
      '2803:f800::/32',
      '2405:b500::/32',
      '2405:8100::/32',
      '2a06:98c0::/29',
      '2c0f:f248::/32',
    ]

    expect(realIpSource).toContain('real_ip_header CF-Connecting-IP')
    for (const range of [...cloudflareIpv4Ranges, ...cloudflareIpv6Ranges]) {
      expect(realIpSource).toContain(`set_real_ip_from ${range};`)
    }
    expect(nginxSource).not.toContain('real_ip_header CF-Connecting-IP')
  })

  it('does not leave deprecated SSL templates trusting arbitrary real-ip headers', () => {
    expect(legacySslSource).not.toContain('set_real_ip_from 0.0.0.0/0')
  })

  it('forwards a usable client IP to the docker registry proxy even without Cloudflare headers', () => {
    expect(dockerProxySource).toContain('proxy_set_header X-Real-IP $remote_addr;')
    expect(dockerProxySource).toContain('proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;')
    expect(dockerProxySource).not.toContain('proxy_set_header X-Real-IP $http_cf_connecting_ip;')
    expect(dockerProxySource).not.toContain('proxy_set_header X-Forwarded-For $http_cf_connecting_ip;')
  })
})

type RedirectableMusicEntity = {
  id: string
  entry_status: string
  redirect_to?: string | null
}

export async function resolveMusicRedirect<T extends RedirectableMusicEntity>(
  initialId: string,
  load: (id: string) => Promise<T>,
  maxHops = 5,
): Promise<{ entity: T; redirected: boolean }> {
  const visited = new Set<string>()
  let currentId = initialId
  let current = await load(currentId)
  let followedRedirect = false

  for (let hop = 0; hop < maxHops; hop += 1) {
    if (current.entry_status !== 'closed') {
      return { entity: current, redirected: followedRedirect }
    }
    const nextId = current.redirect_to?.trim()
    if (!nextId || visited.has(nextId)) {
      return { entity: current, redirected: false }
    }
    visited.add(currentId)
    currentId = nextId
    followedRedirect = true
    current = await load(currentId)
  }

  return {
    entity: current,
    redirected: followedRedirect && current.entry_status !== 'closed',
  }
}

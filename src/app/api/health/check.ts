const TIMEOUT_MS = 2000

type Deps = { pingDb(): Promise<boolean>; pingStorage(): Promise<boolean> }

/** A dependency that throws, answers false, or takes longer than 2 s counts as down. */
async function probe(fn: () => Promise<boolean>): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), TIMEOUT_MS)
  })
  try {
    return await Promise.race([fn().then((v) => v === true).catch(() => false), timeout])
  } finally {
    clearTimeout(timer)
  }
}

export async function checkHealth(deps: Deps): Promise<Response> {
  const [db, storage] = await Promise.all([probe(deps.pingDb), probe(deps.pingStorage)])
  const ok = db && storage
  return Response.json({ status: ok ? 'ok' : 'error', db, storage }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}

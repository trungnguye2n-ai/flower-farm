// Photo upload. A route handler, not a Server Action, because actions cap the
// body at 1 MB; so it does its own CSRF (Origin) and session checks.
import { revalidatePath } from 'next/cache'
import { currentAdmin } from '@/auth/current'
import { SESSION_COOKIE } from '@/auth/cookie'
import { checkOrigin } from '@/auth/origin'
import { getDb } from '@/db/client'
import { MAX_UPLOAD_BYTES } from '@/images/process'
import { addProductImage, s3Storage } from '@/images/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (status: number, body: object) => Response.json(body, { status })

function cookie(header: string | null, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!checkOrigin(request.headers)) return json(403, { ok: false, error: 'Yêu cầu không hợp lệ' })
  const admin = await currentAdmin(getDb(), cookie(request.headers.get('cookie'), SESSION_COOKIE))
  if (!admin) return json(401, { ok: false, error: 'Phiên đăng nhập đã hết, đăng nhập lại' })

  // Multipart overhead is small; refuse clearly oversized bodies before reading them
  if (Number(request.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return json(413, { ok: false, error: 'Ảnh lớn hơn 15 MB' })
  }
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  const productId = form?.get('productId')
  if (!(file instanceof File) || typeof productId !== 'string') return json(400, { ok: false, error: 'Thiếu ảnh hoặc sản phẩm' })
  if (file.size > MAX_UPLOAD_BYTES) return json(413, { ok: false, error: 'Ảnh lớn hơn 15 MB' })

  const alt = form?.get('alt')
  const result = await addProductImage(getDb(), s3Storage, {
    productId,
    file: Buffer.from(await file.arrayBuffer()),
    alt: typeof alt === 'string' ? alt : '',
  })
  if (!result.ok) return json(400, { ok: false, error: result.error })
  revalidatePath('/')
  revalidatePath('/admin')
  return json(200, { ok: true, id: result.data.id })
}

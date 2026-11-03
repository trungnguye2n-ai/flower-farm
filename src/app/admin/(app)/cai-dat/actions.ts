'use server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/auth/guard'
import { saveSettings, type SettingsInput } from '@/admin/settings'
import type { Result } from '@/admin/result'
import { getDb } from '@/db/client'

export async function saveSettingsAction(input: SettingsInput): Promise<Result<null>> {
  await requireAdmin()
  const result = await saveSettings(getDb(), input)
  if (result.ok) {
    revalidatePath('/')
    revalidatePath('/admin/cai-dat')
  }
  return result
}

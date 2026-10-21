import { createHash } from 'crypto'

/**
 * Minecraft accounts.
 *
 * OFFLINE: UUID = nameUUIDFromBytes("OfflinePlayer:" + username) — exactly like vanilla Minecraft.
 * Offline accounts are for singleplayer / your own test servers with online-mode=false.
 * They NEVER impersonate a licensed Microsoft account.
 *
 * MICROSOFT: real OAuth 2.0 Device Code flow (Microsoft Identity Platform)
 *   1) POST login.microsoftonline.com/consumers/oauth2/v2.0/devicecode
 *   2) user enters code at microsoft.com/link (we never see the password)
 *   3) poll /token -> Microsoft access_token + refresh_token
 *   4) Xbox Live auth  (user.auth.xboxlive.com)
 *   5) XSTS token      (xsts.auth.xboxlive.com)
 *   6) Minecraft login (api.minecraftservices.com/authentication/login_with_xbox)
 *   7) Profile + ownership check (api.minecraftservices.com/minecraft/profile, /entitlements/mcstore)
 *
 * Requires your own Azure AD app (client_id) with scope XboxLive.signin — set it in WinCode AI settings.
 */

export function offlineUuid(username: string): string {
  const md5 = createHash('md5').update(Buffer.from(`OfflinePlayer:${username}`, 'utf8')).digest()
  const b = Buffer.from(md5)
  b[6] = (b[6] & 0x0f) | 0x30 // version 3
  b[8] = (b[8] & 0x3f) | 0x80 // variant
  const hex = b.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export interface DeviceCodeInfo {
  userCode: string
  verificationUri: string
  deviceCode: string
  interval: number
  expiresIn: number
}

const TENANT = 'consumers'
const SCOPE = 'XboxLive.signin offline_access'

export async function startDeviceCode(clientId: string): Promise<DeviceCodeInfo> {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, scope: SCOPE })
  })
  const json: any = await res.json()
  if (!res.ok) throw new Error(`Microsoft devicecode ${res.status}: ${json.error_description || JSON.stringify(json)}`)
  return {
    userCode: json.user_code,
    verificationUri: json.verification_uri,
    deviceCode: json.device_code,
    interval: json.interval || 5,
    expiresIn: json.expires_in || 900
  }
}

export interface MicrosoftTokens { accessToken: string; refreshToken: string; expiresAt: number }

export async function pollDeviceToken(clientId: string, deviceCode: string, intervalSec: number, timeoutMs = 300_000): Promise<MicrosoftTokens> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    await new Promise(r => setTimeout(r, intervalSec * 1000))
    const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    })
    const json: any = await res.json()
    if (res.ok && json.access_token) {
      return { accessToken: json.access_token, refreshToken: json.refresh_token || '', expiresAt: Date.now() + (json.expires_in || 3600) * 1000 }
    }
    if (json.error === 'authorization_pending' || json.error === 'slow_down') {
      if (json.error === 'slow_down') intervalSec += 5
      continue
    }
    throw new Error(`Microsoft login: ${json.error_description || json.error || res.status}`)
  }
  throw new Error('Время ожидания входа Microsoft истекло. Попробуйте ещё раз.')
}

export async function refreshMicrosoft(clientId: string, refreshToken: string): Promise<MicrosoftTokens> {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, refresh_token: refreshToken, grant_type: 'refresh_token', scope: SCOPE })
  })
  const json: any = await res.json()
  if (!res.ok) throw new Error(`Microsoft refresh: ${json.error_description || json.error}`)
  return { accessToken: json.access_token, refreshToken: json.refresh_token || refreshToken, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 }
}

async function xboxLive(msAccessToken: string): Promise<{ token: string; uhs: string }> {
  const res = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccessToken}` },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    })
  })
  const json: any = await res.json()
  if (!res.ok) throw new Error(`Xbox Live auth ${res.status}`)
  return { token: json.Token, uhs: json.DisplayClaims.xui[0].uhs }
}

async function xsts(xblToken: string): Promise<{ token: string; uhs: string }> {
  const res = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    })
  })
  const json: any = await res.json()
  if (!res.ok) {
    const code = json.XErr
    const hint = code === 2148916238 ? ' (аккаунту нужен профиль Xbox)' : code === 2148916233 ? ' (нет Xbox аккаунта)' : code === 2148916235 ? ' (Xbox недоступен в регионе)' : ''
    throw new Error(`XSTS ${res.status} XErr=${code}${hint}`)
  }
  return { token: json.Token, uhs: json.DisplayClaims.xui[0].uhs }
}

export interface MinecraftProfile { id: string; name: string; accessToken: string; expiresAt: number; skinUrl?: string }

export async function minecraftLogin(msAccessToken: string): Promise<MinecraftProfile> {
  const xbl = await xboxLive(msAccessToken)
  const xs = await xsts(xbl.token)
  const loginRes = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${xs.uhs};${xs.token}` })
  })
  const login: any = await loginRes.json()
  if (!loginRes.ok) throw new Error(`Minecraft login ${loginRes.status}: ${login.errorMessage || ''}`)
  const mcToken: string = login.access_token

  // Ownership check: user must actually own Minecraft: Java Edition
  const ent = await fetch('https://api.minecraftservices.com/entitlements/mcstore', {
    headers: { Authorization: `Bearer ${mcToken}` }
  })
  const entJson: any = await ent.json().catch(() => ({}))
  const owns = (entJson.items || []).some((i: any) => i.name === 'product_minecraft' || i.name === 'game_minecraft')
  if (!owns) throw new Error('Этот Microsoft-аккаунт не владеет Minecraft: Java Edition.')

  const profRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${mcToken}` }
  })
  const prof: any = await profRes.json()
  if (!profRes.ok) throw new Error('Не удалось получить профиль Minecraft (возможно, не создан никнейм).')
  const uuid = String(prof.id).replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, '$1-$2-$3-$4-$5')
  const skin = (prof.skins || []).find((s: any) => s.state === 'ACTIVE')?.url
  return { id: uuid, name: prof.name, accessToken: mcToken, expiresAt: Date.now() + (login.expires_in || 86400) * 1000, skinUrl: skin }
}

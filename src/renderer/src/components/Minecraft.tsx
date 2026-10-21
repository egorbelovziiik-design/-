import React, { useState } from 'react'
import { Blocks, Rocket, Gamepad2, Eye, Wrench, Server, FolderOpen, Wand2, User, ShieldCheck, Plus, Trash2, KeyRound } from 'lucide-react'
import { useStore, saveAccounts } from '../store'
import type { MinecraftProjectOptions, McAccount } from '@shared/types'
import { runCommand } from './SidePanels'

const TYPES: { id: MinecraftProjectOptions['type']; title: string; desc: string; icon: any }[] = [
  { id: 'fabric-client', title: 'Minecraft Visual Client (Fabric)', desc: 'ClickGUI, HUD (ArrayList/FPS/Координаты/Keystrokes), Module Manager, конфиги, фиолетовый стиль', icon: Eye },
  { id: 'fabric-mod', title: 'Fabric Mod', desc: 'Fabric Loom, Yarn mappings, Java 21, готовая структура мода', icon: Blocks },
  { id: 'forge-mod', title: 'Forge Mod', desc: 'ForgeGradle 6, mods.toml, официальные mappings', icon: Wrench },
  { id: 'neoforge-mod', title: 'NeoForge Mod', desc: 'ModDevGradle, neoforge.mods.toml', icon: Wrench },
  { id: 'plugin', title: 'Paper Plugin', desc: 'Paper API, plugin.yml — для вашего сервера', icon: Server },
  { id: 'launcher', title: 'Minecraft Launcher', desc: 'JavaFX: Offline + Microsoft OAuth, версии с серверов Mojang, RAM/JVM, сборка в EXE через jpackage', icon: Rocket }
]

export function MinecraftPanel() {
  const { log, openProject, projectRoot } = useStore()
  const [type, setType] = useState<MinecraftProjectOptions['type']>('fabric-client')
  const [name, setName] = useState('MyVisualClient')
  const [modId, setModId] = useState('myvisualclient')
  const [pkg, setPkg] = useState('com.example.client')
  const [version, setVersion] = useState('1.21.4')
  const [parentDir, setParentDir] = useState('')
  const [busy, setBusy] = useState(false)

  const input = 'w-full bg-[#14141F] border border-(--color-border) rounded-lg px-2 py-1.5 text-[12.5px] outline-none focus:border-(--color-accent2)'

  async function create() {
    let dir = parentDir
    if (!dir) { dir = await window.api.dialog.openFolder(); if (!dir) return; setParentDir(dir) }
    setBusy(true)
    try {
      const o: MinecraftProjectOptions = { type, name: name.trim(), modId: modId.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''), packageName: pkg.trim(), parentDir: dir, mcVersion: version }
      const res = await window.api.mc.createProject(o)
      log(`Minecraft-проект создан: ${res.root} (${res.fileCount} файлов)`, 'sys')
      log(res.wrapperOk ? 'Gradle Wrapper скачан — gradlew готов к работе.' : '⚠️ Не удалось скачать gradle-wrapper (нет интернета?). Выполните в папке проекта: gradle wrapper', res.wrapperOk ? 'sys' : 'err')
      await openProject(res.root)
    } catch (e: any) { log(`Создание проекта: ${e.message}`, 'err') } finally { setBusy(false) }
  }

  const clientTasks = [
    { l: 'Target HUD', p: 'Добавь в мой Fabric Visual Client модуль Target HUD: показывается при атаке сущности, аватар, ник, здоровье с анимацией полосы HP, броня. Фиолетовый неон, скругления.' },
    { l: 'Custom Crosshair', p: 'Добавь модуль Custom Crosshair в мой Fabric клиент: настраиваемые размер, цвет (фиолетовый градиент), отключение ванильного прицела через Mixin на InGameHud.' },
    { l: 'CPS Counter', p: 'Добавь в мой Fabric Visual Client HUD-модуль CPS Counter (клики в секунду для LMB и RMB) с аккуратным фиолетовым оформлением и подсчётом за последнюю секунду.' },
    { l: 'ESP (визуальный)', p: 'Добавь визуальный ESP-рендер для сущностей в одиночной игре: боксы и nametags через рендер-хелпер на WorldRenderEvents, с настройкой цвета. Только клиентский визуал.' },
    { l: 'Keybind Manager UI', p: 'Сделай в ClickGUI привязку клавиш модулей: правый клик по модулю — режим бинда, следующая клавиша назначается, сохраняется в конфиг JSON.' },
    { l: 'Item Physics / Анимации', p: 'Добавь визуальный модуль плавных анимаций предметов в руке и кастомный главный экран (Main Menu) в чёрно-фиолетовом стиле с логотипом клиента.' }
  ]

  return (
    <div className="h-full flex flex-col p-3 gap-2 overflow-auto">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-(--color-muted) font-semibold"><Gamepad2 size={13} /> Minecraft Development Center</div>
      {TYPES.map(t => (
        <button key={t.id} onClick={() => setType(t.id)} className={`text-left border rounded-xl p-2.5 transition ${type === t.id ? 'border-(--color-accent2) bg-(--color-selected)' : 'border-(--color-border) bg-[#12121D] hover:border-(--color-accent)'}`}>
          <div className="flex items-center gap-2"><t.icon size={15} className="text-(--color-accent2)" /><span className="text-[12.5px] font-medium">{t.title}</span></div>
          <div className="text-[11px] text-(--color-muted) mt-1 leading-snug">{t.desc}</div>
        </button>
      ))}
      <div className="grid grid-cols-2 gap-1.5 mt-1">
        <label className="text-[11px] text-(--color-muted)">Название<input className={input} value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="text-[11px] text-(--color-muted)">Mod ID<input className={input} value={modId} onChange={e => setModId(e.target.value)} /></label>
        <label className="text-[11px] text-(--color-muted)">Пакет Java<input className={input} value={pkg} onChange={e => setPkg(e.target.value)} /></label>
        <label className="text-[11px] text-(--color-muted)">Версия Minecraft
          <select className={input} value={version} onChange={e => setVersion(e.target.value)}>
            {['1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1'].map(v => <option key={v} value={v}>{v}</option>)}
          </select></label>
      </div>
      <div className="flex gap-1.5">
        <input className={input} placeholder="Папка, где создать проект…" value={parentDir} onChange={e => setParentDir(e.target.value)} />
        <button className="px-2.5 rounded-lg bg-(--color-hover) hover:bg-(--color-selected) shrink-0" title="Выбрать папку" onClick={async () => { const d = await window.api.dialog.openFolder(); if (d) setParentDir(d) }}><FolderOpen size={14} /></button>
      </div>
      <button onClick={create} disabled={busy || !name.trim()} className="bg-(--color-accent) hover:bg-(--color-accent2) disabled:opacity-50 text-white rounded-lg py-2 text-[13px] font-medium">
        {busy ? 'Создание настоящего проекта…' : 'Создать проект'}
      </button>
      <div className="text-[11px] text-(--color-muted) leading-snug">Создаётся реальный Gradle-проект (Fabric Loom / ForgeGradle / ModDevGradle / Paper / JavaFX Launcher) со скачанным Gradle Wrapper. Нужен JDK 21. Функции, влияющие на геймплей, тестируйте в одиночной игре или на собственном сервере.</div>

      {projectRoot && (<>
        <div className="border-t border-(--color-border) mt-2 pt-2">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-(--color-muted) font-semibold mb-1.5"><Wand2 size={12} /> AI: добавить модуль в текущий клиент</div>
          <div className="flex flex-wrap gap-1.5">
            {clientTasks.map((t, i) => (
              <button key={i} onClick={() => window.dispatchEvent(new CustomEvent('wincode:ai-ask', { detail: { mode: 'AGENT', text: t.p } }))}
                className="text-[11.5px] px-2 py-1 rounded-full border border-(--color-border) hover:border-(--color-accent2) hover:bg-(--color-hover)">{t.l}</button>
            ))}
          </div>
        </div>
        <div className="border-t border-(--color-border) mt-1 pt-2">
          <div className="text-[11px] uppercase tracking-wider text-(--color-muted) font-semibold mb-1.5">Быстрые Gradle-команды</div>
          <div className="grid grid-cols-2 gap-1.5">
            <button className="text-[12px] bg-emerald-600/85 text-white rounded-lg py-1.5" onClick={() => runCommand(navigator.platform.startsWith('Win') ? '.\\gradlew.bat runClient' : './gradlew runClient', projectRoot, 'runClient')}>gradlew runClient</button>
            <button className="text-[12px] bg-(--color-hover) hover:bg-(--color-selected) rounded-lg py-1.5" onClick={() => runCommand(navigator.platform.startsWith('Win') ? '.\\gradlew.bat build' : './gradlew build', projectRoot, 'build')}>gradlew build</button>
            <button className="text-[12px] bg-(--color-hover) hover:bg-(--color-selected) rounded-lg py-1.5" onClick={() => runCommand(navigator.platform.startsWith('Win') ? '.\\gradlew.bat genSources' : './gradlew genSources', projectRoot, 'genSources')}>genSources</button>
            <button className="text-[12px] bg-(--color-hover) hover:bg-(--color-selected) rounded-lg py-1.5" onClick={() => runCommand(navigator.platform.startsWith('Win') ? '.\\gradlew.bat runServer' : './gradlew runServer', projectRoot, 'runServer')}>runServer</button>
          </div>
        </div>
      </>)}
    </div>
  )
}

/* ---------------- Accounts ---------------- */
export function AccountsPanel() {
  const { accounts, activeAccountId, settings, log } = useStore()
  const [nick, setNick] = useState('')
  const [deviceInfo, setDeviceInfo] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const input = 'w-full bg-[#14141F] border border-(--color-border) rounded-lg px-2 py-1.5 text-[12.5px] outline-none focus:border-(--color-accent2)'

  async function addOffline() {
    const name = nick.trim()
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) { log('Никнейм для Offline Account: 3–16 символов, латиница/цифры/_.', 'err'); return }
    const uuid: string = await window.api.mc.offlineUuid(name)
    const acc: McAccount = { id: crypto.randomUUID(), type: 'offline', username: name, uuid }
    saveAccounts([...accounts, acc], acc.id)
    log(`Offline Account создан: ${name} (${uuid}). Подходит для одиночной игры и своих серверов с online-mode=false.`, 'sys')
    setNick('')
  }

  async function addMicrosoft() {
    setBusy(true)
    const off = window.api.mc.onDeviceCode((d: any) => setDeviceInfo(d))
    try {
      const { profile }: any = await window.api.mc.msLogin(settings.azureClientId)
      const acc: McAccount = { id: crypto.randomUUID(), type: 'microsoft', username: profile.name, uuid: profile.id }
      saveAccounts([...accounts.filter(a => a.uuid !== acc.uuid), acc], acc.id)
      log(`Microsoft Account вошёл: ${profile.name} (${profile.id}) — владение Minecraft: Java Edition подтверждено.`, 'sys')
    } catch (e: any) { log(`Microsoft Login: ${e.message}`, 'err') }
    finally { off?.(); setDeviceInfo(null); setBusy(false) }
  }

  return (
    <div className="h-full flex flex-col p-3 gap-2 overflow-auto">
      <div className="text-[11px] uppercase tracking-wider text-(--color-muted) font-semibold">Minecraft Accounts</div>
      <div className="space-y-1.5">
        {accounts.map(a => (
          <div key={a.id} className={`flex items-center gap-2.5 border rounded-xl p-2.5 ${a.id === activeAccountId ? 'border-(--color-accent2) bg-(--color-selected)' : 'border-(--color-border) bg-[#12121D]'}`}>
            <img src={`https://mc-heads.net/avatar/${a.uuid.replace(/-/g, '')}/36`} alt="" className="w-9 h-9 rounded-md bg-[#1B1B2A]" onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate">{a.username}</div>
              <div className="text-[10.5px] text-(--color-muted) truncate font-mono">{a.uuid}</div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${a.type === 'microsoft' ? 'bg-sky-500/15 text-sky-300' : 'bg-zinc-500/15 text-zinc-300'}`}>{a.type === 'microsoft' ? 'Microsoft' : 'Offline'}</span>
            </div>
            {a.id !== activeAccountId && <button className="text-[11.5px] px-2 py-1 rounded bg-(--color-accent) text-white" onClick={() => saveAccounts(accounts, a.id)}>Выбрать</button>}
            <button className="p-1.5 rounded hover:bg-red-500/10 text-(--color-muted) hover:text-red-300" onClick={() => saveAccounts(accounts.filter(x => x.id !== a.id), a.id === activeAccountId ? null : activeAccountId)}><Trash2 size={14} /></button>
          </div>
        ))}
        {accounts.length === 0 && <div className="text-[12px] text-(--color-muted)">Аккаунтов пока нет.</div>}
      </div>

      <div className="border border-(--color-border) rounded-xl p-3 bg-[#12121D] space-y-2 mt-1">
        <div className="flex items-center gap-1.5 text-[12.5px] font-medium"><User size={14} className="text-zinc-300" /> Offline Account</div>
        <input className={input} placeholder="Никнейм (Steve, Alex…)" value={nick} onChange={e => setNick(e.target.value)} onKeyDown={e => e.key === 'Enter' && addOffline()} />
        <button onClick={addOffline} className="flex items-center justify-center gap-1.5 w-full bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg py-1.5 text-[12.5px]"><Plus size={13} /> Add Offline Account</button>
        <div className="text-[10.5px] text-(--color-muted) leading-snug">Offline UUID генерируется как в ванильном Minecraft. Не выдаёт себя за лицензию: только одиночная игра и свои серверы с online-mode=false.</div>
      </div>

      <div className="border border-sky-500/30 rounded-xl p-3 bg-[#0E1522] space-y-2">
        <div className="flex items-center gap-1.5 text-[12.5px] font-medium"><ShieldCheck size={14} className="text-sky-300" /> Microsoft Account</div>
        {deviceInfo ? (
          <div className="text-[12px] bg-sky-500/10 border border-sky-500/30 rounded-lg p-2">
            Откройте <span className="text-sky-300">microsoft.com/link</span> и введите код:<br />
            <span className="text-lg font-bold tracking-widest text-white">{deviceInfo.userCode}</span><br />
            Ожидание подтверждения входа…
          </div>
        ) : (
          <button onClick={addMicrosoft} disabled={busy} className="flex items-center justify-center gap-1.5 w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg py-1.5 text-[12.5px]"><KeyRound size={13} /> {busy ? 'Вход…' : 'Login with Microsoft'}</button>
        )}
        <div className="text-[10.5px] text-(--color-muted) leading-snug">Официальный OAuth 2.0 Device Code → Xbox Live → Minecraft Services. Пароль не запрашивается приложением. Требуется ваш Azure client_id (Настройки → Accounts) и лицензионный Minecraft: Java Edition.</div>
      </div>
    </div>
  )
}

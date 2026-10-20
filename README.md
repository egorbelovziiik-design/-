# WinCode AI

**WinCode AI** — профессиональная AI-powered IDE для Windows 10/11 (Java, Kotlin, Minecraft, Web, AI Agent).
Настоящее десктопное приложение на Electron + React + TypeScript, а не сайт и не макет.

![Build](https://github.com/egorbelovziiik-design/-/actions/workflows/build-windows.yml/badge.svg)

---

## 📦 Установка (Windows 10 / 11)

**Готовые сборки (GitHub Release `wincode-ai-v1.0.0`, собрано CI на windows-2022):**

| Файл | Размер | Назначение | Ссылка |
|---|---|---|---|
| `WinCode-AI-Setup.exe` | ~100 МБ | Установщик NSIS: выбор папки, ярлыки, меню «Пуск», удаление | [скачать](https://github.com/egorbelovziiik-design/-/releases/download/wincode-ai-v1.0.0/WinCode-AI-Setup.exe) |
| `WinCode-AI-Portable.exe` | ~84 МБ | Портативная версия без установки | [скачать](https://github.com/egorbelovziiik-design/-/releases/download/wincode-ai-v1.0.0/WinCode-AI-Portable.exe) |

Те же файлы лежат в артефакте запуска Actions `wincode-ai-windows`
(страница запуска: [Build Windows EXE](https://github.com/egorbelovziiik-design/-/actions/workflows/build-windows.yml)).

Сборка выполняется GitHub Actions (Windows Runner) при каждом push. Локально на Windows:

```bash
npm ci
npm run dist        # соберёт оба EXE в release/WinCode-AI-Setup.exe и release/WinCode-AI-Portable.exe
```

## 🧩 Что реально работает

### IDE-ядро
- ✅ Проводник файлов: создание, переименование, удаление (в Корзину), контекстные меню, drag-вкладок
- ✅ Monaco Editor: подсветка (Java, Kotlin, TS/JS, Python, C/C++, C#, Rust, Go, JSON, XML, YAML, HTML/CSS и др.),
  IntelliSense (встроенные языковые сервисы Monaco для TS/JS/JSON/HTML/CSS), code folding, мини-карта,
  множественные курсоры, поиск-замена, форматирование, брекеты, sticky scroll
- ✅ Вкладки: перетаскивание между колонками, split editor (`Ctrl+\`), autosave, «грязные» индикаторы
- ✅ Встроенный терминал: **node-pty + xterm.js** (PowerShell/CMD/bash), несколько сессий, resize, цветной вывод
  (fallback на pipe-mode, если PTY недоступен)
- ✅ Система сборки: RUN / BUILD / TEST / STOP, авто-детект Gradle / Maven / npm / pnpm / yarn / CMake / Cargo,
  парсер ошибок (javac, kotlinc, tsc, gcc, python) → панель Problems
- ✅ Git: status, stage/unstage, commit, push, pull, ветки, checkout, diff, log, init, clone, discard
- ✅ Проекты: New Project wizard (12 шаблонов), Open Folder, Recent Projects, детект типа проекта
- ✅ Настройки: 12 категорий, 6 тем, шрифты, keybindings, автосохранение, приватность
- ✅ Командная палитра (`Ctrl+P` / `Ctrl+Shift+P`), уведомления, статус-бар, стартовый экран
- ✅ Безопасный Electron: contextIsolation, nodeIntegration=false, preload API, sandbox путей, шифрование API-ключей
  через safeStorage (DPAPI), удаление только в Корзину, подтверждение опасных операций

### WinCode Intelligence (AI) — **реальные запросы к моделям, без имитации**
- ✅ Провайдеры: **OpenAI, Anthropic Claude, Google Gemini, OpenRouter, Ollama, LM Studio, любой OpenAI-compatible**
  (API Key, Base URL, модель, температура, контекст) — streaming (SSE) + tool calling
- ✅ AI Chat с потоковым выводом и прикреплением текущего файла
- ✅ **AI Agent Mode** — реально выполняет инструменты: `read_file`, `write_file`, `list_dir`, `search_files`,
  `create_directory`, `run_command`, `delete_path`, `update_memory`, `save_plan`, `finish`
- ✅ Режимы: **ASK / EDIT / AGENT / PLAN / DEBUG / AUTOPILOT** (EDIT ограничивает запись выбранными файлами)
- ✅ Система разрешений: опасные команды и удаления требуют подтверждения в модальном окне
- ✅ **AI Inline Completion** — ghost-text предложения прямо в Monaco (Tab/Esc)
- ✅ **Fix with AI** — анализ логов сборки и предложение исправлений
- ✅ **AI Project Memory** — архитектура, ключевые классы, история ошибок, версия Minecraft/loader;
  сохраняется между сессиями (JSON store, атомарные записи)
- ✅ **RAG-индексация проекта** — инкрементальный индекс с TF-IDF поиском, семантический контекст для AI

### Minecraft Development Center
- ✅ Wizard проекта с **матрицей совместимости версий** (1.8.9 → 1.21.4): Java / Fabric Loader / Fabric API /
  Yarn / Loom / Forge / NeoForge — несовместимые комбинации исключены
- ✅ Шаблоны: **Fabric Mod, Visual/PvP Client, Forge Mod, NeoForge Mod, Paper/Spigot Plugin, Minecraft Launcher**
- ✅ Visual Client template — настоящий Gradle-проект: Module system, Event Bus, **ClickGUI**, HUD
  (FPS, Coordinates, ArrayList, Keystrokes), модули Sprint / Fullbright / AutoWalk
- ✅ Launcher template: Microsoft OAuth device-code flow, piston-meta, проверка SHA-1, запуск игры
- ✅ Gradle wrapper генерируется автоматически; задачи `runClient`, `remapJar`, `shadowJar` в панели сборки
- ✅ **AI GUI Builder** — визуальный редактор перетаскиванием с генерацией реального кода:
  HTML/CSS, Java Swing, Minecraft GUI (Yarn)

## 🧪 Проверки качества

```bash
npm run typecheck   # строгий TypeScript (renderer + electron)
npm run build       # production сборка renderer + main
npm run smoke       # smoke-тесты конфигурации и артефактов
npm run logic       # unit-тесты сервисного слоя (шаблоны, store, детект сборки)
```

Все проверки выполняются в CI на каждый push.

## 📋 Честный статус функций (v1.0)

| Функция | Статус |
|---|---|
| Запуск на Windows 10/11 (EXE) | ✅ `WinCode-AI-Setup.exe` (105 МБ) и `WinCode-AI-Portable.exe` (88 МБ) собраны и опубликованы в [Release](https://github.com/egorbelovziiik-design/-/releases/tag/wincode-ai-v1.0.0) |
| Создание/открытие проектов, файлы, сохранение | ✅ |
| Терминал (xterm.js + node-pty) | ✅ |
| AI Chat + реальные AI-провайдеры + streaming | ✅ |
| AI Agent: создание/изменение файлов, команды | ✅ |
| AI Inline Completion | ✅ |
| Gradle/Maven/npm сборка, ошибки, Problems | ✅ |
| Java-поддержка | ✅ Monaco + полная сборка Gradle/Maven-диагностика |
| Minecraft Fabric проект + сборка | ✅ |
| Настройки, темы, keybindings | ✅ |
| Git интеграция | ✅ |
| AI GUI Builder | ✅ (генерация рабочего кода из визуального макета) |
| Полный DAP-отладчик (шаги, breakpoints, variables) | 🟡 Бета: Debug-панель, «Fix with AI», запуск конфигураций; пошаговый DAP — через подключение внешнего адаптера (JDT LS/debugpy) в настройках |
| Внешние Language Servers (JDT LS, metals и т.п.) | 🟡 Архитектура готова; Monaco LS встроен; внешние LS подключаются указанием пути в Settings → Java |
| Plugin Manager | ✅ установка локальных плагинов (wincode-plugin.json) + 4 встроенных расширения |
| Обновления приложения | 🟡 Проверка версии реализована, авто-обновление — в следующем релизе |

## 🔐 Безопасность и право

- API-ключи шифруются через OS-хранилище (DPAPI на Windows) и уходят только напрямую к выбранному AI-провайдеру.
- Опасные команды AI (удаление, `rm -rf`, `git push --force` и т.п.) всегда требуют подтверждения пользователя.
- Minecraft-инструменты предназначены для локальной разработки и использования на собственных серверах —
  соблюдайте EULA Mojang и правила серверов.

## 🛠 Технологии

Electron 33 · React 18 · TypeScript 5 · Vite 5 · Tailwind CSS · Monaco Editor · xterm.js · node-pty ·
zustand · framer-motion · lucide-react · electron-builder (NSIS + Portable)

## 📁 Структура

```
electron/          main process: IPC, services (files, git, terminal, build, ai, memory, indexer, templates, plugins)
src/               renderer: React UI (editor, explorer, terminal, AI panel, wizard, settings, GUI builder)
build/             иконка приложения
scripts/           dev/build/smoke/logic-скрипты
.github/workflows  CI: сборка Windows EXE на windows-latest
```

## Горячие клавиши

| Клавиша | Действие |
|---|---|
| `Ctrl+S` / `Ctrl+Shift+S` | Сохранить / Сохранить всё |
| `Ctrl+P` / `Ctrl+Shift+P` | Быстрое открытие / командная палитра |
| `Ctrl+Shift+E/F/G` | Проводник / Поиск / Git |
| `Ctrl+Shift+A` | AI-панель |
| `` Ctrl+` `` | Терминал |
| `Ctrl+\` | Разделить редактор |
| `F5` / `Shift+F5` | Запуск / Стоп |
| `Ctrl+,` | Настройки |

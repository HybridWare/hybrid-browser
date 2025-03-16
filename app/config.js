import { app, ipcMain } from 'electron'
import RC from 'rc'

import os from 'node:os'
import path from 'node:path'
import url from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

const USER_DATA = app.getPath('userData')
const DEFAULT_EXTENSIONS_DIR = path.join(USER_DATA, 'extensions')
const DEFAULT_IPFS_DIR = path.join(USER_DATA, 'ipfs')
const DEFAULT_HYPER_DIR = path.join(USER_DATA, 'hyper')
// const DEFAULT_SSB_DIR = path.join(USER_DATA, 'ssb')
const DEFAULT_BT_DIR = path.join(USER_DATA, 'bt')

const DEFAULT_PAGE = 'hybrid://welcome'

const DEFAULT_CONFIG_FILE_NAME = '.hybridrc'
export const MAIN_RC_FILE = path.join(os.homedir(), DEFAULT_CONFIG_FILE_NAME)

const Config = RC('hybrid', {
  llm: {
    enabled: true,

    baseURL: 'http://127.0.0.1:11434/v1/',
    // Uncomment this to use OpenAI instead
    // baseURL: 'https://api.openai.com/v1/'
    apiKey: 'ollama',
    model: 'qwen2.5-coder:7b-instruct-q4_K_M'
  },
  accelerators: {
    OpenDevTools: 'CommandOrControl+Shift+I',
    NewWindow: 'CommandOrControl+N',
    Forward: 'CommandOrControl+]',
    Back: 'CommandOrControl+[',
    FocusURLBar: 'CommandOrControl+L',
    FindInPage: 'CommandOrControl+F',
    Reload: 'CommandOrControl+R',
    HardReload: 'CommandOrControl+Shift+R',
    LearnMore: null,
    OpenExtensionsFolder: null,
    EditConfigFile: 'CommandOrControl+.',
    CreateBookmark: 'CommandOrControl+D'
  },

  extensions: {
    dir: DEFAULT_EXTENSIONS_DIR,
    // TODO: This will be for loading extensions from remote URLs
    remote: []
  },

  theme: {
    'font-family': 'system-ui',
    background: 'var(--hy-color-white)',
    text: 'var(--hy-color-black)',
    primary: 'var(--hy-color-blue)',
    secondary: 'var(--hy-color-red)',
    indent: '16px',
    'max-width': '666px'
  },

  defaultPage: DEFAULT_PAGE,
  autoHideMenuBar: false,

  err: true,

  bt: {
    dir: DEFAULT_BT_DIR,
    refresh: false,
    status: true,
    block: true
  },

  ipfs: {
    repo: DEFAULT_IPFS_DIR,
    refresh: false,
    status: true,
    block: true
  },

  hyper: {
    storage: DEFAULT_HYPER_DIR,
    refresh: false,
    status: true,
    block: true
  },
  oui: {
    status: true
  },

  gemini: {
    status: true
  },

  gopher: {
    status: true
  },

  hhttp: {
    status: true
  },

  tor: {
    status: true
  },

  iip: {
    status: true
  },
  vid: {
    status: true
  }
})

export default Config

export function addPreloads (session) {
  const preloadPath = path.join(url.fileURLToPath(new URL('./', import.meta.url)), 'settings-preload.js')
  const preloads = session.getPreloads()
  preloads.push(preloadPath)
  session.setPreloads(preloads)
}

ipcMain.handle('settings-save', async (event, configMap) => {
  await save(configMap)
})

export async function save (configMap) {
  const currentRC = await getRCData()
  let hasChanged = false
  for (const [key, value] of Object.entries(configMap)) {
    const existing = getFrom(key, Config)
    if (existing === undefined) continue
    if (value === existing) continue
    hasChanged = true
    setOn(key, Config, value)
    setOn(key, currentRC, value)
  }
  if (hasChanged) {
    await writeFile(MAIN_RC_FILE, JSON.stringify(currentRC, null, '\t'))
  }
}

async function getRCData () {
  try {
    const data = await readFile(MAIN_RC_FILE, 'utf8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

function setOn (path, object, value) {
  if (path.includes('.')) {
    const [key, subkey] = path.split('.')
    if (typeof object[key] !== 'object') {
      object[key] = {}
    }
    object[key][subkey] = value
  } else {
    object[path] = value
  }
}

// No support for more than one level
function getFrom (path, object) {
  if (path.includes('.')) {
    const [key, subkey] = path.split('.')
    if (typeof object[key] !== 'object') return undefined
    return object[key][subkey]
  } else {
    return object[path]
  }
}

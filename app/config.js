import { app } from 'electron'
import path from 'path'
import RC from 'rc'

const USER_DATA = app.getPath('userData')
const DEFAULT_EXTENSIONS_DIR = path.join(USER_DATA, 'extensions')
const DEFAULT_IPFS_DIR = path.join(USER_DATA, 'ipfs')
const DEFAULT_HYPER_DIR = path.join(USER_DATA, 'hyper')
// const DEFAULT_SSB_DIR = path.join(USER_DATA, 'ssb')
const DEFAULT_BT_DIR = path.join(USER_DATA, 'bt')

const DEFAULT_PAGE = 'hybrid://welcome'

export default RC('hybrid', {
  llm: {
    enabled: true,

    baseURL: 'http://127.0.0.1:11434/v1/',
    // Uncomment this to use OpenAI instead
    // baseURL: 'https://api.openai.com/v1/'
    apiKey: 'ollama',
    model: 'phi3:3.8b-mini-4k-instruct-q4_0'
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

  bt: {
    dir: DEFAULT_BT_DIR,
    refresh: true,
    status: true,
    block: true
  },

  ipfs: {
    repo: DEFAULT_IPFS_DIR,
    refresh: true,
    status: true,
    block: true
  },
  
  hyper: {
    storage: DEFAULT_HYPER_DIR,
    refresh: true,
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

  lok: {
    status: true
  }
})

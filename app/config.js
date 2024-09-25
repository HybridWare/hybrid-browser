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

  // All options here: https://github.com/webtorrent/webtorrent/blob/master/docs/api.md
  bt: {
    dir: DEFAULT_BT_DIR,
    refresh: false,
    status: true,
    block: true
  },

  // All options here: https://github.com/ipfs/js-ipfs/blob/master/docs/CONFIG.md
  ipfs: {
    repo: DEFAULT_IPFS_DIR,
    refresh: false,
    status: true,
    block: true
  },

  // All options here: https://github.com/datproject/sdk/#const-hypercore-hyperdrive-resolvename-keypair-derivesecret-registerextension-close--await-sdkopts
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

  lok: {
    status: true
  },

  extra: {
    relay: true,
    port: 3000
  }
})

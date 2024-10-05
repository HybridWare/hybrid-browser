import { app, protocol as globalProtocol } from 'electron'
import Config from '../config.js'
import Relay from '../relay.js'

const P2P_PRIVILEGES = {
  standard: true,
  secure: true,
  allowServiceWorkers: true,
  supportFetchAPI: true,
  bypassCSP: false,
  corsEnabled: true,
  stream: true
}

const BROWSER_PRIVILEGES = {
  standard: false,
  secure: true,
  allowServiceWorkers: false,
  supportFetchAPI: true,
  bypassCSP: false,
  corsEnabled: true
}

const LOW_PRIVILEGES = {
  standard: false,
  secure: false,
  allowServiceWorkers: false,
  supportFetchAPI: false,
  bypassCSP: false,
  corsEnabled: true
}

const CS_PRIVILEGES = {
  standard: true,
  secure: false,
  allowServiceWorkers: true,
  supportFetchAPI: true,
  bypassCSP: false,
  corsEnabled: true,
  stream: true
}

const {
  ipfs,
  hyper,
  bt,
  oui,
  gemini,
  gopher,
  hhttp,
  tor,
  iip,
  lok,
  extra
} = Config

const onCloseHandlers = []

export async function close () {
  await Promise.all(onCloseHandlers.map((handler) => handler()))
}

export function registerPrivileges () {
  globalProtocol.registerSchemesAsPrivileged([
    { scheme: 'hybrid', privileges: BROWSER_PRIVILEGES },
    { scheme: 'bt', privileges: P2P_PRIVILEGES },
    { scheme: 'magnet', privileges: LOW_PRIVILEGES },
    { scheme: 'ipfs', privileges: P2P_PRIVILEGES },
    { scheme: 'hyper', privileges: P2P_PRIVILEGES },
    { scheme: 'oui', privileges: CS_PRIVILEGES },
    { scheme: 'ouis', privileges: P2P_PRIVILEGES },
    { scheme: 'gemini', privileges: P2P_PRIVILEGES },
    { scheme: 'gopher', privileges: CS_PRIVILEGES },
    { scheme: 'hhttp', privileges: CS_PRIVILEGES },
    { scheme: 'hhttps', privileges: P2P_PRIVILEGES },
    { scheme: 'tor', privileges: CS_PRIVILEGES },
    { scheme: 'tors', privileges: P2P_PRIVILEGES },
    { scheme: 'iip', privileges: CS_PRIVILEGES },
    { scheme: 'iips', privileges: P2P_PRIVILEGES },
    { scheme: 'lok', privileges: CS_PRIVILEGES },
    { scheme: 'loks', privileges: P2P_PRIVILEGES },
    { scheme: 'msg', privileges: P2P_PRIVILEGES },
    { scheme: 'pubsub', privileges: P2P_PRIVILEGES },
    { scheme: 'topic', privileges: P2P_PRIVILEGES }
  ])
}

export async function checkProtocols(){
  if(bt.refresh){
    await fs.emptyDir(bt.dir)
  }
  if(ipfs.refresh){
    await fs.emptyDir(ipfs.repo)
  }
  if(hyper.refresh){
    await fs.emptyDir(hyper.storage)
  }
}

export function setAsDefaultProtocolClient () {
  console.log('Setting as default handlers')
  app.setAsDefaultProtocolClient('hybrid')
  app.setAsDefaultProtocolClient('bt')
  app.setAsDefaultProtocolClient('ipfs')
  app.setAsDefaultProtocolClient('hyper')
  app.setAsDefaultProtocolClient('oui')
  app.setAsDefaultProtocolClient('ouis')
  app.setAsDefaultProtocolClient('gemini')
  app.setAsDefaultProtocolClient('gopher')
  app.setAsDefaultProtocolClient('hhttp')
  app.setAsDefaultProtocolClient('hhttps')
  app.setAsDefaultProtocolClient('tor')
  app.setAsDefaultProtocolClient('tors')
  app.setAsDefaultProtocolClient('iip')
  app.setAsDefaultProtocolClient('iips')
  app.setAsDefaultProtocolClient('lok')
  app.setAsDefaultProtocolClient('loks')
  app.setAsDefaultProtocolClient('msg')
  app.setAsDefaultProtocolClient('pubsub')
  app.setAsDefaultProtocolClient('topic')
}

export async function setupProtocols (session) {
  const { protocol: sessionProtocol } = session

  const {default: createBrowserHandler} = await import('./browser-protocol.js')
  const browserProtocolHandler = await createBrowserHandler()
  sessionProtocol.handle('hybrid', browserProtocolHandler)
  globalProtocol.handle('hybrid', browserProtocolHandler)

  console.log('registered hybrid protocol')

  const torrentz = await (async () => {const {default: Torrentz} = await import('torrentz');return new Torrentz(bt);})()
  const helia = await (async () => {const {createHelia} = await import('helia');const {FsDatastore} = await import('datastore-fs');const {FsBlockstore} = await import('blockstore-fs');const {identify} = await import('@libp2p/identify');const {kadDHT} = await import('@libp2p/kad-dht');const {gossipsub} = await import('@chainsafe/libp2p-gossipsub');return await createHelia({blockstore: new FsBlockstore(ipfs.repo), datastore: new FsDatastore(ipfs.repo), libp2p: {services: {dht: kadDHT(), pubsub: gossipsub(), identify: identify()}}});})()
  const sdk = await (async () => {const SDK = await import('hyper-sdk');const sdk = await SDK.create(hyper);return sdk;})()

  // msg
  const {default: createMsgHandler} = await import('./msg-protocol.js')
  const { handler: msgHandler, close: closeMsg } = await createMsgHandler({...bt, torrentz}, session)
  onCloseHandlers.push(closeMsg)
  sessionProtocol.handle('msg', msgHandler)
  globalProtocol.handle('msg', msgHandler)

  console.log('registered msg protocol')
  // msg

  // pubsub
  const {default: createPubsubHandler} = await import('./pubsub-protocol.js')
  const { handler: pubsubHandler, close: closePubsub } = await createPubsubHandler({...ipfs, helia}, session)
  onCloseHandlers.push(closePubsub)
  sessionProtocol.handle('pubsub', pubsubHandler)
  globalProtocol.handle('pubsub', pubsubHandler)

  console.log('registered pubsub protocol')
  // pubsub

  // topic
  const {default: createTopicHandler} = await import('./topic-protocol.js')
  const { handler: topicHandler, close: closeTopic } = await createTopicHandler({...hyper, sdk}, session)
  onCloseHandlers.push(closeTopic)
  sessionProtocol.handle('topic', topicHandler)
  globalProtocol.handle('topic', topicHandler)

  console.log('registered topic protocol')
  // topic

  // bt
  const {default: createBTHandler} = await import('./bt-protocol.js')
  const { handler: btHandler, close: closeBT } = await createBTHandler({...bt, torrentz}, session)
  onCloseHandlers.push(closeBT)
  sessionProtocol.handle('bt', btHandler)
  globalProtocol.handle('bt', btHandler)

  const {default: createMagnetHandler} = await import('./magnet-protocol.js')
  const magnetHandler = await createMagnetHandler()
  sessionProtocol.handle('magnet', magnetHandler)
  globalProtocol.handle('magnet', magnetHandler)

  console.log('registered bt protocol')
  // bt

  // ipfs
  const {default: createIPFSHandler} = await import('./ipfs-protocol.js')
  const { handler: ipfsHandler, close: closeIPFS } = await createIPFSHandler({...ipfs, helia}, session)
  onCloseHandlers.push(closeIPFS)
  sessionProtocol.handle('ipfs', ipfsHandler)
  globalProtocol.handle('ipfs', ipfsHandler)

  console.log('registered ipfs protocol')
  // ipfs

  // hyper
  const {default: createHyperHandler} = await import('./hyper-protocol.js')
  const { handler: hyperHandler, close: closeHyper } = await createHyperHandler({...hyper, sdk}, session)
  onCloseHandlers.push(closeHyper)
  sessionProtocol.handle('hyper', hyperHandler)
  globalProtocol.handle('hyper', hyperHandler)

  console.log('registered hyper protocol')
  // hyper

  // oui
  const {default: createOuiHandler} = await import('./oui-protocol.js')
  const ouiHandler = await createOuiHandler(oui, session)
  sessionProtocol.handle('oui', ouiHandler)
  globalProtocol.handle('oui', ouiHandler)
  sessionProtocol.handle('ouis', ouiHandler)
  globalProtocol.handle('ouis', ouiHandler)

  console.log('registered ouinet protocol')
  // oui

  // gemini
  const {default: createGeminiHandler} = await import('./gemini-protocol.js')
  const geminiHandler = await createGeminiHandler(gemini, session)
  sessionProtocol.handle('gemini', geminiHandler)
  globalProtocol.handle('gemini', geminiHandler)

  console.log('registered gemini protocol')
  // gemini

  // gopher
  const {default: createGopherHandler} = await import('./gopher-protocol.js')
  const gopherHandler = await createGopherHandler(gopher, session)
  sessionProtocol.handle('gopher', gopherHandler)
  globalProtocol.handle('gopher', gopherHandler)

  console.log('registered gopher protocol')
  // gopher

  // hhttp
  const {default: createHHTTPHandler} = await import('./hhttp-protocol.js')
  const hhttpHandler = await createHHTTPHandler(hhttp, session)
  sessionProtocol.handle('hhttp', hhttpHandler)
  globalProtocol.handle('hhttp', hhttpHandler)
  sessionProtocol.handle('hhttps', hhttpHandler)
  globalProtocol.handle('hhttps', hhttpHandler)
  
  console.log('registered hhttp protocol')
  // hhttp

  // tor
  const {default: createTorHandler} = await import('./tor-protocol.js')
  const torHandler = await createTorHandler(tor, session)
  sessionProtocol.handle('tor', torHandler)
  globalProtocol.handle('tor', torHandler)
  sessionProtocol.handle('tors', torHandler)
  globalProtocol.handle('tors', torHandler)
  
  console.log('registered tor protocol')
  // tor

  // iip
  const {default: createIipHandler} = await import('./iip-protocol.js')
  const iipHandler = await createIipHandler(iip, session)
  sessionProtocol.handle('iip', iipHandler)
  globalProtocol.handle('iip', iipHandler)
  sessionProtocol.handle('iips', iipHandler)
  globalProtocol.handle('iips', iipHandler)

  console.log('registered i2p protocol')
  // iip

  // loki
  const {default: createLokHandler} = await import('./lok-protocol.js')
  const lokHandler = await createLokHandler(lok, session)
  sessionProtocol.handle('lok', lokHandler)
  globalProtocol.handle('lok', lokHandler)
  sessionProtocol.handle('loks', lokHandler)
  globalProtocol.handle('loks', lokHandler)

  console.log('registered lokinet protocol')
  // loki

  if(extra.relay){
    const relay = new Relay(torrentz, helia, sdk)
    relay.start(extra.port)
    onCloseHandlers.push(async () => {return await relay.close(false)})
  }
}

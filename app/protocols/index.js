import { app, protocol as globalProtocol } from 'electron'
import Relay from '../relay.js'
import fs from 'fs-extra'
import Config from '../config.js'

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

export const onCloseHandlers = []

export async function close () {
  await Promise.all(onCloseHandlers.map((handler) => {return handler()}))
}

export function setAsDefaultProtocolClient () {
  console.log('Setting as default handlers')
  app.setAsDefaultProtocolClient('hybrid')
  if(bt.status){
    app.setAsDefaultProtocolClient('bt')
  }
  if(ipfs.status){
    app.setAsDefaultProtocolClient('ipfs')
  }
  if(hyper.status){
    app.setAsDefaultProtocolClient('hyper')
  }
  if(oui.status){
    app.setAsDefaultProtocolClient('oui')
    app.setAsDefaultProtocolClient('ouis')
  }
  if(gemini.status){
    app.setAsDefaultProtocolClient('gemini')
  }
  if(gopher.status){
    app.setAsDefaultProtocolClient('gopher')
  }
  if(hhttp.status){
    app.setAsDefaultProtocolClient('hhttp')
    app.setAsDefaultProtocolClient('hhttps')
  }
  if(tor.status){
    app.setAsDefaultProtocolClient('tor')
    app.setAsDefaultProtocolClient('tors')
  }
  if(iip.status){
    app.setAsDefaultProtocolClient('iip')
    app.setAsDefaultProtocolClient('iips')
  }
  if(lok.status){
    app.setAsDefaultProtocolClient('lok')
    app.setAsDefaultProtocolClient('loks')
  }
  console.log('registered default handlers')
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

export function registerPrivileges(){
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
    { scheme: 'loks', privileges: P2P_PRIVILEGES }
  ])
}

export async function setupProtocols (session) {
  const { protocol: sessionProtocol } = session
  
  const {default: createBrowserHandler} = await import('./browser-protocol.js')
  const browserProtocolHandler = await createBrowserHandler()
  sessionProtocol.handle('hybrid', browserProtocolHandler)
  globalProtocol.handle('hybrid', browserProtocolHandler)

  console.log('registered hybrid protocol')

  // bt
  const torrentz = bt.status ? await (async () => {const {default: torrentzFunc} = await import('torrentz');const Torrentz = await torrentzFunc();return new Torrentz(bt);})() : null
  if(bt.status){
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
  }
  // bt

  // ipfs
  const helia = ipfs.status ? await (async () => {const {createHelia} = await import('helia');const {FsDatastore} = await import('datastore-fs');const {FsBlockstore} = await import('blockstore-fs');const {identify} = await import('@libp2p/identify');const {kadDHT} = await import('@libp2p/kad-dht');const {gossipsub} = await import('@chainsafe/libp2p-gossipsub');return await createHelia({blockstore: new FsBlockstore(ipfs.repo), datastore: new FsDatastore(ipfs.repo), libp2p: {services: {dht: kadDHT(), pubsub: gossipsub(), identify: identify()}}});})() : null
  if(ipfs.status){
    const {default: createIPFSHandler} = await import('./ipfs-protocol.js')
    const { handler: ipfsHandler, close: closeIPFS } = await createIPFSHandler({...ipfs, helia}, session)
    onCloseHandlers.push(closeIPFS)
    sessionProtocol.handle('ipfs', ipfsHandler)
    globalProtocol.handle('ipfs', ipfsHandler)
  
    console.log('registered ipfs protocol')
  }
  // ipfs

  // hyper
  const sdk = hyper.status ? await (async () => {const SDK = await import('hyper-sdk');const sdk = await SDK.create(hyper);return sdk;})() : null
  if(hyper.status){
    const {default: createHyperHandler} = await import('./hyper-protocol.js')
    const { handler: hyperHandler, close: closeHyper } = await createHyperHandler({...hyper, sdk}, session)
    onCloseHandlers.push(closeHyper)
    sessionProtocol.handle('hyper', hyperHandler)
    globalProtocol.handle('hyper', hyperHandler)
  
    console.log('registered hyper protocol')
  }
  // hyper

  // oui
  if(oui.status){
    const {default: createOuiHandler} = await import('./oui-protocol.js')
    const ouiHandler = await createOuiHandler(oui, session)
    sessionProtocol.handle('oui', ouiHandler)
    globalProtocol.handle('oui', ouiHandler)
    sessionProtocol.handle('ouis', ouiHandler)
    globalProtocol.handle('ouis', ouiHandler)
  
    console.log('registered ouinet protocol')
  }
  // oui

  // gemini
  if(gemini.status){
    const {default: createGeminiHandler} = await import('./gemini-protocol.js')
    const geminiHandler = await createGeminiHandler(gemini, session)
    sessionProtocol.handle('gemini', geminiHandler)
    globalProtocol.handle('gemini', geminiHandler)
  
    console.log('registered gemini protocol')
  }
  // gemini

  // gopher
  if(gopher.status){
    const {default: createGopherHandler} = await import('./gopher-protocol.js')
    const gopherHandler = await createGopherHandler(gopher, session)
    sessionProtocol.handle('gopher', gopherHandler)
    globalProtocol.handle('gopher', gopherHandler)
  
    console.log('registered gopher protocol')
  }
  // gopher

  // hhttp
  if(hhttp.status){
    const {default: createHHTTPHandler} = await import('./hhttp-protocol.js')
    const hhttpHandler = await createHHTTPHandler(hhttp, session)
    sessionProtocol.handle('hhttp', hhttpHandler)
    globalProtocol.handle('hhttp', hhttpHandler)
    sessionProtocol.handle('hhttps', hhttpHandler)
    globalProtocol.handle('hhttps', hhttpHandler)
    
    console.log('registered hhttp protocol')
  }
  // hhttp

  // tor
  if(tor.status){
    const {default: createTorHandler} = await import('./tor-protocol.js')
    const torHandler = await createTorHandler(tor, session)
    sessionProtocol.handle('tor', torHandler)
    globalProtocol.handle('tor', torHandler)
    sessionProtocol.handle('tors', torHandler)
    globalProtocol.handle('tors', torHandler)
    
    console.log('registered tor protocol')
  }
  // tor

  // iip
  if(iip.status){
    const {default: createIipHandler} = await import('./iip-protocol.js')
    const iipHandler = await createIipHandler(iip, session)
    sessionProtocol.handle('iip', iipHandler)
    globalProtocol.handle('iip', iipHandler)
    sessionProtocol.handle('iips', iipHandler)
    globalProtocol.handle('iips', iipHandler)
  
    console.log('registered i2p protocol')
  }
  // iip

  // loki
  if(lok.status){
    const {default: createLokHandler} = await import('./lok-protocol.js')
    const lokHandler = await createLokHandler(lok, session)
    sessionProtocol.handle('lok', lokHandler)
    globalProtocol.handle('lok', lokHandler)
    sessionProtocol.handle('loks', lokHandler)
    globalProtocol.handle('loks', lokHandler)
  
    console.log('registered lokinet protocol')
  }
  // loki

  if(extra.relay && bt.status && ipfs.status && hyper.status){
    const relay = new Relay(torrentz, helia, sdk)
    relay.start(extra.port)
    onCloseHandlers.push(async () => {return await relay.close(false)})
  }
}

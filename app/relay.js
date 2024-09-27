import {createServer} from 'http'
import {WebSocketServer} from 'ws'

export default class makeLocalFetch {
    constructor(bt, ipfs, hyper){
        this.bt = bt
        this.ipfs = ipfs
        this.hyper = hyper
        // const express = require('express')
        // const app = express()
        // app.get('/', (req, res) => {
        //     return res.statusCode(200).json('success')
        // })
        // app.get('*', (req, res) => {
        //     return res.statusCode(400).json('unsuccessful')
        // })
        this.http = createServer()
        this.ws = new WebSocketServer({server: this.http, path: '/', clientTracking: true})

        this.hyperConnection = (soc, data) => {
            this.ws.clients.forEach((ws) => {
                if(ws.proto === 'hyper'){
                    if(data.topics.includes(ws.id)){
                        if(!ws.users.includes(soc.publicKey)){
                            if(!ws.method){
                                soc.onData = (msg) => {
                                    ws.send(msg)
                                }
                                soc.on('data', soc.onData)
                            }
                            soc.onError = (err) => {
                                console.error(err)
                            }
                            soc.onClose = () => {
                                if(ws.users.includes(soc.publicKey)){
                                    ws.users.splice(ws.users.indexOf(soc.publicKey), 1)
                                }
                                if(!ws.method){
                                    soc.off('data', soc.onData)
                                }
                                soc.off('error', soc.onError)
                                soc.off('close', soc.onClose)
                            }
                            soc.on('error', soc.onError)
                            soc.on('close', soc.onClose)
                            ws.users.push(soc.publicKey)
                        }
                    }
                }
            })
        }
        this.hyper.swarm.on('connection', this.hyperConnection)

        this.ipfsConnection = (message) => {
            this.ws.clients.forEach((ws) => {
                if(ws.proto === 'ipfs'){
                    if(message.detail.topic === ws.id){
                        ws.send(message.detail.data)
                    }
                }
            })
            // console.log(`${message.detail.topic}:`, new TextDecoder().decode(message.detail.data))
        }
        this.ipfs.libp2p.services.pubsub.addEventListener('message', this.ipfsConnection)

        this.http.onRequest = (req, res) => {
            if(req.url === '/'){
                res.end('thanks for testing Hybrid')
            } else {
                res.end('*')
            }
        }
        this.http.onClose = () => {
            console.log('closing')
        }
        this.http.onListening = () => {
            console.log('listening')
        }
        this.http.onError = (err) => {
            console.error(err)
        }

        this.ws.onConnection = (socket, req) => {
            const params = new URLSearchParams(req.url)
            if(!params.has('protocol') || !params.has('method') || !params.has('id')){
                socket.send('must have protocol, id, and method url params')
                socket.close()
            } else {
                const protocol = params.get('protocol')
                const id = params.get('id')
                const method = params.get('method')

                if(protocol === 'bt'){
                    if(method === 'read'){
                        let i = false
                        this.ws.clients.forEach((data) => {
                            if(data.id === id){
                                i = true
                            }
                        })
                        if(i){
                            socket.send('already have id')
                            socket.close()
                        } else {
                            const torrent = this.bt.checkTheTorrent(id)
                            if(torrent){
                                socket.proto = 'bt'
                                socket.id = id
                                torrent.checkMessage = (data) => {
                                    socket.send(data)
                                }
                                torrent.over = () => {
                                    socket.close()
                                }
                                torrent.on('message', torrent.checkMessage)
                                torrent.on('over', torrent.over)
                                socket.checkError = (err) => {
                                    console.error(err)
                                }
                                socket.checkClose = () => {
                                    console.log('closed')
                                    torrent.off('message', torrent.checkMessage)
                                    torrent.off('over', torrent.over)
                                    socket.off('error', socket.checkError)
                                    socket.off('close', socket.checkClose)
                                }
                                socket.on('close', socket.checkClose)
                            } else {
                                socket.send('could not find torrent')
                                socket.close()
                            }
                        }
                    } else if(method === 'write'){
                        let i = false
                        this.ws.clients.forEach((data) => {
                            if(data.id === id){
                                i = true
                            }
                        })
                        if(i){
                            socket.send('already have id')
                            socket.close()
                        } else {
                            const torrent = this.bt.checkTheTorrent(id)
                            if(torrent){
                                socket.proto = 'bt'
                                socket.id = id
                                torrent.over = () => {
                                    socket.close()
                                }
                                torrent.on('over', torrent.over)
                                socket.onMessage = (prop) => {
                                    torrent.say(prop.data)
                                }
                                socket.on('message', socket.onMessage)
                                socket.checkError = (err) => {
                                    console.error(err)
                                }
                                socket.checkClose = () => {
                                    console.log('closed')
                                    torrent.off('over', torrent.over)
                                    socket.off('message', socket.onMessage)
                                    socket.off('error', socket.checkError)
                                    socket.off('close', socket.checkClose)
                                }
                                socket.on('close', socket.checkClose)
                            } else {
                                socket.send('could not find torrent')
                                socket.close()
                            }
                        }
                    } else {
                        socket.send('method is invalid')
                        socket.close()
                    }
                } else if(protocol === 'ipfs'){
                    if(method === 'read'){
                        let i = false
                        this.ws.clients.forEach((data) => {
                            if(data.id === id){
                                i = true
                            }
                        })
                        if(i){
                            socket.send('already have id')
                            socket.close()
                        } else {
                            this.ipfs.libp2p.services.pubsub.subscribe(id)
                            socket.proto = 'ipfs'
                            socket.id = id
                            socket.method = false
                            socket.users = []
                            socket.checkError = (err) => {
                                console.error(err)
                            }
                            socket.checkClose = () => {
                                console.log('closed')
                                socket.off('error', socket.checkError)
                                socket.off('close', socket.checkClose)
                            }
                            socket.on('error', socket.onError)
                            socket.on('close', socket.onClose)
                        }
                    } else if(method === 'write'){
                        const id = params.get('id')
                        let i = false
                        this.ws.clients.forEach((data) => {
                            if(data.id === id){
                                i = true
                            }
                        })
                        if(i){
                            socket.send('already have id')
                            socket.close()
                        } else {
                            socket.proto = 'ipfs'
                            socket.id = id
                            socket.method = true
                            socket.users = []
                            socket.checkMessage = (prop) => {
                                this.ipfs.libp2p.services.pubsub.publish(id, new TextEncoder().encode(prop.data))
                            }
                            socket.checkError = (err) => {
                                console.error(err)
                            }
                            socket.checkClose = () => {
                                console.log('closed')
                                socket.off('message', socket.checkMessage)
                                socket.off('error', socket.checkError)
                                socket.off('close', socket.checkClose)
                            }
                            socket.on('message', socket.checkMessage)
                            socket.on('error', socket.onError)
                            socket.on('close', socket.onClose)
                        }
                    } else {
                        socket.send('method is invalid')
                        socket.close()
                    }
                } else if(protocol === 'hyper'){
                    if(method === 'read'){
                        const id = params.get('id')
                        let i = false
                        this.ws.clients.forEach((data) => {
                            if(data.id === id){
                                i = true
                            }
                        })
                        if(i){
                            socket.send('already have id')
                            socket.close()
                        } else {
                            const topic = this.hyper.swarm.join(id, {})
                            if(topic){
                                socket.proto = 'hyper'
                                socket.id = id
                                socket.method = false
                                socket.users = []
                                socket.checkError = (err) => {
                                    console.error(err)
                                }
                                socket.checkClose = () => {
                                    console.log('closed')
                                    topic.destroy().then(console.log).catch(console.error)
                                    socket.off('message', socket.checkMessage)
                                    socket.off('error', socket.checkError)
                                    socket.off('close', socket.checkClose)
                                }
                                socket.on('error', socket.onError)
                                socket.on('close', socket.onClose)
                            } else {
                                socket.send('could not find topic')
                                socket.close()
                            }
                        }
                    } else if(method === 'write'){
                        const id = params.get('id')
                        let i = false
                        this.ws.clients.forEach((data) => {
                            if(data.id === id){
                                i = true
                            }
                        })
                        if(i){
                            socket.send('already have id')
                            socket.close()
                        } else {
                            const topic = this.hyper.swarm.join(id, {})
                            if(topic){
                                socket.proto = 'hyper'
                                socket.id = id
                                socket.method = true
                                socket.users = []
                                socket.checkMessage = (prop) => {
                                    socket.users.forEach((user) => {
                                        this.hyper.swarm.connections.forEach((con) => {
                                            if(con.publicKey === user){
                                                con.write(prop.data)
                                            }
                                        })
                                    })
                                }
                                socket.checkError = (err) => {
                                    console.error(err)
                                }
                                socket.checkClose = () => {
                                    console.log('closed')
                                    topic.destroy().then(console.log).catch(console.error)
                                    socket.off('message', socket.checkMessage)
                                    socket.off('error', socket.checkError)
                                    socket.off('close', socket.checkClose)
                                }
                                socket.on('message', socket.checkMessage)
                                socket.on('error', socket.onError)
                                socket.on('close', socket.onClose)
                            } else {
                                socket.send('could not find topic')
                                socket.close()
                            }
                        }
                    } else {
                        socket.send('method is invalid')
                        socket.close()
                    }
                } else {
                    socket.send('protocol is invalid')
                    socket.close()
                }
            }
        }
        this.ws.onClose = () => {
            this.ws.off('connection', this.ws.onConnection)
            this.ws.off('listening', this.ws.onListening)
            this.ws.off('error', this.ws.onError)
            this.ws.off('close', this.ws.onClose)
            console.log('closing')
        }
        this.ws.onError = (err) => {
            console.error(err)
        }
        this.ws.onListening = () => {
            console.log('listening')
        }
    }
    attach(){
        this.ws.on('connection', this.ws.onConnection)
        this.ws.on('close', this.ws.onClose)
        this.ws.on('error', this.ws.onError)
        this.ws.on('listening', this.ws.onListening)
    }
    start(port){
        this.http.on('close', this.http.onClose)
        this.http.on('listening', this.http.onListening)
        this.http.on('error', this.http.onError)
        this.http.on('request', this.http.onRequest)
        if(!this.http.listening){
            this.http.listen(port)
        }
    }
    stop(){
        this.http.off('close', this.http.onClose)
        this.http.off('listening', this.http.onListening)
        this.http.off('error', this.http.onError)
        this.http.off('request', this.http.onRequest)
        if(this.http.listening){
            this.http.close()
        }
    }
    async close(data){
        if(data){
            await this.bt.close()
            await this.ipfs.close()
            await this.hyper.close()
        }
        this.stop()
    }
}
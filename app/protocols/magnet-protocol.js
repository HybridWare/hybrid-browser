import { Readable } from 'stream'
import magnet from 'magnet-uri'

function intoStream (data) {
  return new Readable({
    read () {
      this.push(data)
      this.push(null)
    }
  })
}

function parseQuery(data){
  if(data){
    let str = '?'
    const arr = data.split(',')
    for(const i of arr){
      const kv = i.split(':')
      str = str + kv[0] + '=' + kv[1] + '&'
    }
    return str
  } else {
    return ''
  }
}

function parseHeader(data, session){
  if(data){
    const arr = data.split(',')
    for(const i of arr){
      const kv = i.split(':')
      session.headers.set(kv[0], kv[1])
    }
  }
}

export default function(proto){
  const obj = proto
  return async function(session){
    try {
      const parsed = magnet(session.url)
      if(parsed.xt && session.method === 'GET'){
        const arr = parsed.xt.split(':')
        if(arr[0] === 'urn'){
          if(arr[1] === 'btih' || arr[1] === 'btpk'){
            return new Response('', {headers: {'Location': `bt://${arr[2]}/`}, status: 308})
          } else {
            throw new Error('must have btih or btpk')
          }
        } else {
          throw new Error('must have urn')
        }
      } else {
        delete session.url
        parsed.xn = parsed.xn || '/'
        parseHeader(parsed.xo, session)
        if(obj[parsed.xp]){
          return await obj[parsed.xp](new Request(`${parsed.xp}://${parsed.xh || parsed.xk}${parsed.xn}${parseQuery(parsed.xq)}`, session))
        } else {
          throw new Error('unknown scheme')
        }
      }
    } catch (error) {
      return new Response(intoStream(error.stack), {status: 500, statusText: error.message})
    }
  }
}
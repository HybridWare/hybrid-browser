export default async function makeGopher(opts = {}) {
    const Gopher = await import('gopher-lib')
    const DEFAULT_OPTS = {timeout: 30000}
    const useTimeOut = opts.timeout || DEFAULT_OPTS.timeout
    const finalOpts = { ...DEFAULT_OPTS, ...opts }
    delete finalOpts.timeout
    const gopher = new Gopher.Client(finalOpts)
  
    async function makeQuery(link) {
      const sendText = await new Promise((resolve, reject) => {
        gopher.get(link, (err, reply)=>{
            if(err) {
              reject(err);
            } else {
              resolve(reply.text || '')
            }
          });
      })
      return {status: 200, headers: {'Content-Type': 'text/plain'}, body: sendText}
    }
  
    return async function useThefetch(session){
      // const session = new Request(url, opt)
      const gopherReq = new URL(session.url, session.referrer)
      const reqHeaders = new Headers(session.headers)
      const searchParams = gopherReq.searchParams
  
      if(!gopherReq.hostname.startsWith('gopher.')){
        gopherReq.hostname = 'gopher.' + gopherReq.hostname
      }
      
      const mainTimeout = reqHeaders.has('x-timer') || searchParams.has('x-timer') ? reqHeaders.get('x-timer') !== '0' || searchParams.get('x-timer') !== '0' ? Number(reqHeaders.get('x-timer') || searchParams.get('x-timer')) * 1000 : 0 : useTimeOut
  
      const tempRes = mainTimeout ?
      await Promise.race([
        new Promise((resolve, reject) => setTimeout(() => { const err = new Error('timed out'); err.name = 'timeout'; reject(err) }, mainTimeout)),
        makeQuery(gopherReq.href)
      ]) :
      await makeQuery(gopherReq.href)

      return new Response(tempRes.body, {...tempRes})
    }
  }
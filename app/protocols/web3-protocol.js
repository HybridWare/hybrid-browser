import { Client } from 'web3protocol'

export default async function makeWeb3 (options) {
    const { chainList, ...opts } = options
    const web3Client = new Client(chainList, opts)

    return async function useThefetch(session){
      if (session.method !== 'GET') {
        return new Response('Method Not Allowed', {
          status: 405
        })
      }
      const { httpCode, httpHeaders, output } = await web3Client.fetchUrl(session.url)

      return new Response(output, { status: httpCode, headers: httpHeaders })
    }
}
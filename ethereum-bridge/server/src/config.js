const port = process.env.GG_SERVER_PORT || 3000
const rpcConnection = process.env.GG_SERVER_RPC_CONNECTION || 'http://127.0.0.1:9545'
const isTestRun = process.env.GG_SERVER_TEST_RUN || '0'

const config = {
  port: port,
  rpcConnection: rpcConnection,
  isTestRun: isTestRun === '1',
}

console.log('config', config)

export default config

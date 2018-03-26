import Pino from 'pino'
const pino = Pino()

const host = process.env.GG_SERVER_HOST || 'localhost'
const port = process.env.GG_SERVER_PORT || 3000
const rpcConnection = process.env.GG_SERVER_RPC_CONNECTION || 'http://127.0.0.1:9545'
const isTestRun = process.env.GG_SERVER_TEST_RUN || '0'

const config = {
  host: host,
  port: port,
  rpcConnection: rpcConnection,
  isTestRun: isTestRun === '1',
}

pino.info(config, 'config')

export default config

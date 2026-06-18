import { getConfig } from './config'
import { createHttpServer } from './server'

const config = getConfig()
const app = createHttpServer(config)

app.listen(config.port, () => {
	console.log(`Stuwiz ChatGPT app MCP server listening on :${config.port}`)
})

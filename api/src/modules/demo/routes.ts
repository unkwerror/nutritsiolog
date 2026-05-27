import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { HTML } from '../devtools/upload.js'
import { config } from '../../core/config.js'

const demoRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/demo',
        {
            schema: {
                querystring: z.object({ key: z.string().optional() }),
                tags: ['Demo'],
                description: 'Demo UI for client preview — requires DEMO_ACCESS_KEY query param',
            },
        },
        async (request, reply) => {
            const { key } = request.query as { key?: string }

            if (!config.DEMO_ACCESS_KEY || key !== config.DEMO_ACCESS_KEY) {
                return reply
                    .code(403)
                    .type('text/plain')
                    .send('Forbidden: provide a valid ?key= parameter')
            }

            return reply.type('text/html').send(HTML)
        }
    )
}

export default demoRoutes
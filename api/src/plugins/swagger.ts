import fp           from 'fastify-plugin'
import swagger     from '@fastify/swagger'
import swaggerUi   from '@fastify/swagger-ui'
import { jsonSchemaTransform } from 'fastify-type-provider-zod'
import { type FastifyInstance } from 'fastify'

async function swaggerPlugin(fastify: FastifyInstance) {
    fastify.register(swagger, {
        openapi: {
            info: {
                title:   'Nutritsiolog API',
                version: '1.0.0',
            },
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type:   'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                },
            },
            security: [{ bearerAuth: [] }],
        },
        transform: jsonSchemaTransform,
    })

    fastify.register(swaggerUi, {
        routePrefix: '/api/docs',
        uiConfig: { persistAuthorization: true },
    })
}

export default fp(swaggerPlugin)

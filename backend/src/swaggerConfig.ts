import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const routesGlob = path.join(__dirname, 'routes/**/*.js').replace(/\\/g, '/');

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Mock-Scores API',
            version: '1.0.0',
            description: 'REST API for Mock-Scores tournament management',
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: [routesGlob],
};

export const swaggerSpec = swaggerJsdoc(options);

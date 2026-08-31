import swaggerAutogen from "swagger-autogen"

const doc = {
  info: {
    title: 'My Express API',
    description: 'Generated API spec for AI client building'
  },
  servers: [
    {
      url: 'http://localhost:8000'
    }
  ]
};

const outputFile = './docs/api-spec.json';
const routes = ['./src/index.js'];

swaggerAutogen(outputFile, routes, doc).then(() => {
    console.log('✅ OpenAPI JSON generated successfully!');
});

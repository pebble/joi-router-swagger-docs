# joi-router-swagger-docs

A node module for generating [Swagger 2.0](http://swagger.io/) JSON
definitions from existing [koa-joi-router](https://github.com/koajs/joi-router)
routes.

Aiming to be a replacement for
[koa-resourcer-docs](https://github.com/koajs/resourcer-docs) which can
take advantage of various Swagger 2.0 tools for generating client libraries,
test suites, AWS Lambda/serverless, etc.

This is very WIP (many things missing or broken), and thus is not available
on npm yet.

## Example

```js

const SwaggerAPI = require('joi-router-swagger-docs').SwaggerAPI;
const Router = require('koa-joi-router');
const Joi = Router.Joi;
const router = router();

router.get('/signup', {
  validate: {
    type: 'json',
    body: {
      name: Joi.string().max(100).description('new user name')
    },
    output: {
      200: {
        body: {
          userId: Joi.string().description('newly created user id')
        }
      }
    }
  },
  handler: function*() {
    // ...
  }
});

swaggerAPI.addJoiRouter(router);

let spec = swaggerAPI.generateSpec({
  info: {
    title: 'Example API',
    description: 'API for creating and editing examples',
    version: '1.1'
  },
  basePath: '/api/v1'
});

console.log(JSON.stringify(spec, null, '  '));
```

## API

### new SwaggerAPI()

Creates a new SwaggerAPI instance.

### swaggerAPI.addJoiRouter(router, options)

Add a joi-router instance to the API. The router should already have all its
routes set up before calling this method (which pulls the route definitions
from the router's `.routes` property).

Options:
- prefix: Prefix to add to Swagger path

### swaggerAPI.generateSpec(baseSpec)

Create a Swagger specification for this API. A base specification should be
provided with an `info` object (containing at least the `title` and `version`
strings) and any other global descriptions.

## Sponsored by

[Pebble Technology!](https://www.pebble.com)

## License

[MIT](https://github.com/pebble/joi-router-swagger-docs/blob/master/LICENSE)

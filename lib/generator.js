'use strict';

const assert = require('assert');
const pathToRegex = require('path-to-regexp');
const Joi = require('joi');
const joiToJsonSchema = require('joi-to-json-schema');
const each = require('lodash/each');
const pick = require('lodash/pick');
const mapValues = require('lodash/mapValues');

const JSON_SCHEMA_FIELDS = [
  'type', 'required',

  'maximum', 'exclusiveMaximum', 'minimum', 'exclusiveMinimum',
  'maxLength', 'minLength', /*'pattern',*/ 'maxItems', 'minItems',
  'uniqueItems', 'enum', 'multipleOf'
];

const JSON_SCHEMA_NESTED_FIELDS = [
  'items', 'allOf', 'properties', 'additionalProperties'
];

function isRouter(router) {
  return router.routes && router.use;
}

exports.mergeSwaggerPaths = function mergeSwaggerPaths(paths, newPaths, options) {
  const warn = options && options.warnFunc;

  each(newPaths, function(newPathItemObj, path) {
    let pathItemObj = paths[path] = paths[path] || {};

    // Merge operations into path
    each(newPathItemObj, function(operationObj, method) {
      if (pathItemObj[method]) {
        // already exists!
        if(warn) warn(`${path}[${method}] exists in multiple routes`);
        return;
      }

      pathItemObj[method] = operationObj;
    });
  });

  return paths;
}

exports.routesToSwaggerPaths = function routesToSwaggerPaths(routes, options) {
  let paths = {};

  routes.forEach(function(route) {
    let routePaths = exports.routeToSwaggerPaths(route, options);

    exports.mergeSwaggerPaths(paths, routePaths, options);
  });

  return paths;
};

/**
 * For a given joi-router route, return an array of Swagger paths.
 * @param {object} route
 * @returns {object[]} paths
 */
exports.routeToSwaggerPaths = function routeToSwaggerPaths(route, options) {
  options = options || {};

  let paths = {};
  let routeDesc = {
    responses: {
      200: {
        description: 'Success'
      }
    }
  };

  if (route.validate) {
    let type = route.validate.type;

    if (!type) {
      // do nothing
    } else if (type === 'json') {
      routeDesc.consumes = ['application/json'];
    } else if (type === 'form' || type === 'multipart') {
      throw new Error(`${type} type not supported`);
    }

    routeDesc.parameters = exports.validateToSwaggerParameters(route.validate);

    // TODO: add responses from output schema
  }

  if (route.meta && route.meta.swagger) {
    Object.assign(routeDesc, route.meta.swagger);
  }

  let path = exports.swaggerizePath(route.path);

  if (options.prefix) {
    if (options.prefix.endsWith('/') || path.startsWith('/')) {
      path = `${options.prefix}${path}`;
    } else {
      path = `${options.prefix}/${path}`;
    }
  }

  let pathItemObj = paths[path] = {};

  let methods = Array.isArray(route.method) ? route.method : [route.method];

  methods.forEach(function (method) {
    let operationObj = routeDesc;
    pathItemObj[method.toLowerCase()] = operationObj;
  });

  return paths;
};

function addSchemaParameters(parameters, location, schema) {
  let jsonSchema = joiToJsonSchema(Joi.compile(schema));

  if (jsonSchema.type === 'object' && jsonSchema.properties) {
    each(jsonSchema.properties, function(value, name) {
      let parameter = exports.jsonSchemaToSwagger(value);
      parameter.name = name;
      parameter.in = location;

      parameters.push(parameter);
    });
  }
};

/**
 * Convert a JSON schema object to the subset used by Swagger
 */
exports.jsonSchemaToSwagger = function(jsonSchema) {
  if (Array.isArray(jsonSchema)) {
    return jsonSchema.map(exports.jsonSchemaToSwagger);
  }

  let schema = pick(jsonSchema, JSON_SCHEMA_FIELDS);

  if (jsonSchema.items) {
    // FIXME HACK
    if (Array.isArray(jsonSchema.items)) {
      jsonSchema.items = jsonSchema.items[0];
    }

    schema.items = exports.jsonSchemaToSwagger(jsonSchema.items);
  }

  if (jsonSchema.properties) {
    schema.properties = mapValues(jsonSchema.properties, function(value) {
      return exports.jsonSchemaToSwagger(value);
    });
  }

  return schema;
};

/**
 * Convert joi-router validate object to swagger
 */
exports.validateToSwaggerParameters = function(validate) {
  let parameters = [];

  if (validate.header) {
    addSchemaParameters(parameters, 'header', validate.header);
  }

  if (validate.query) {
    addSchemaParameters(parameters, 'query', validate.query);
  }

  if (validate.params) {
    addSchemaParameters(parameters, 'path', validate.params);
  }

  if (validate.body) {
    let jsonSchema = joiToJsonSchema(Joi.compile(validate.body));
    let swaggerSchema = exports.jsonSchemaToSwagger(jsonSchema);

    parameters.push({
      name: 'body',
      in: 'body',
      schema: swaggerSchema
    });
  }

  return parameters;
};

/* Convert a joi-router path into a Swagger parameterized path,
 * e.g. /users/:userId becomes /users/{userId}
 *
 * FIXME: incomplete handling, escaping, etc
 * FIXME: throw error if a complex regex is used
 */
exports.swaggerizePath = function swaggerizePath(path, options) {
  let pathTokens = pathToRegex.parse(path);

  let segments = pathTokens.map(function (token) {
    let segment = token;

    if (token.name) {
      segment = `{${token.name}}`;
    }

    return segment;
  });

  return segments.join('/');
};

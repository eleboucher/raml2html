"use strict";
const path = require("path");
const raml2obj = require("raml2obj");
const pjson = require("./package.json");

const getCurlStatement = require(path.join(__dirname, "lib/stylus-globals.js"))
  .getCurlStatement;
const getLanguage = require(path.join(__dirname, "lib/stylus-globals.js"))
  .getLanguage;
const getResponseHeaders = require(path.join(
  __dirname,
  "lib/stylus-globals.js"
)).getResponseHeaders;
const getSafeId = require(path.join(__dirname, "lib/stylus-globals.js"))
  .getSafeId;
const hasExamples = require(path.join(__dirname, "lib/stylus-globals.js"))
  .hasExamples;
const getTypeDefinitions = require(path.join(
  __dirname,
  "lib/stylus-globals.js"
)).getTypeDefinitions;
const hasType = require(path.join(__dirname, "lib/stylus-globals.js")).hasType;
const getType = require(path.join(__dirname, "lib/stylus-globals.js")).getType;

const defaultTemplatesDir = path.join(__dirname, "templates");

/**
 * Cleans up Markdown string from trailing spaces and excessive line breaks.
 * @param  {string}  input A Markdown string
 * @return {string}        A cleaned up Markdown string
 */
function cleanupMarkdown(input) {
  const trailingSpaces = / +\n/g;
  const excessiveNewLines = /\n{3,}/g;
  if (!input) {
    return input;
  }
  let result = input.replace(trailingSpaces, "\n");
  result = result.replace(excessiveNewLines, "\n\n");
  return result;
}

/**
 * Render the source RAML object using the config's processOutput function
 *
 * The config object should contain at least the following property:
 * processRamlObj: function that takes the raw RAML object and returns a promise with the rendered HTML
 *
 * @param {(String|Object)} source - The source RAML file. Can be a filename, url, contents of the RAML file,
 * or an already-parsed RAML object.
 * @param {Object} config
 * @param {Function} config.processRamlObj
 * @returns a promise
 */
function render(source, config) {
  config = config || {};
  config.raml2HtmlVersion = pjson.version;

  return raml2obj.parse(source).then((ramlObj) => {
    ramlObj.config = config;

    if (config.processRamlObj) {
      return config.processRamlObj(ramlObj).then((html) => {

        return html;
      });
    }

    return ramlObj;
  });
}

/**
 * @param {String} [mainTemplate] - The filename of the main template, leave empty to use default templates
 * @param {String} [templatesPath] - Optional, by default it uses the current working directory
 * @returns {{processRamlObj: Function, postProcessHtml: Function}}
 */
function getDefaultConfig() {
  return {
    processRamlObj(ramlObj) {
      const nunjucks = require("nunjucks");
      const ramljsonexpander = require("raml-jsonschema-expander");

      const template = path.join(defaultTemplatesDir, "root.nunjucks");

      const env = nunjucks
        .configure(defaultTemplatesDir, { autoescape: false })
        .addGlobal("getSafeId", getSafeId)
        .addGlobal("getLanguage", getLanguage)
        .addGlobal("getResponseHeaders", getResponseHeaders)
        .addGlobal("hasExamples", hasExamples)
        .addGlobal("getTypeDefinitions", getTypeDefinitions)
        .addGlobal("hasType", hasType)
        .addGlobal("getType", getType);

      // Find and replace the $ref parameters.
      ramlObj = ramljsonexpander.expandJsonSchemas(ramlObj);


      // Return the promise with the html
      return new Promise((resolve) => {
        let result = env.render(template, ramlObj);
        result = cleanupMarkdown(result);
        return resolve(result);
      });
    },

    postProcessHtml(html) {
      // Minimize the generated html and return the promise with the result
      const Minimize = require("minimize");
      const minimize = new Minimize({ quotes: true });

      return new Promise((resolve, reject) => {
        minimize.parse(html, (error, result) => {
          if (error) {
            reject(new Error(error));
          } else {
            resolve(result);
          }
        });
      });
    },
  };
}

module.exports = {
  getDefaultConfig,
  render,
};

if (require.main === module) {
  console.log(
    "This script is meant to be used as a library. You probably want to run bin/raml2html if you're looking for a CLI."
  );
  process.exit(1);
}

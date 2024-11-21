module.exports = function EpaycoError(lang, code) {
  const error = require("../errors.json");
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = error[code][lang];
};

require("node:util").inherits(module.exports, Error);

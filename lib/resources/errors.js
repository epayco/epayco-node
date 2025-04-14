'use strict';

module.exports = function EpaycoError(lang, code) {
    var error = require("../errors.json");
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = error[code][lang];
};

require('util').inherits(module.exports, Error);

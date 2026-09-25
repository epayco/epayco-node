/**
 * Shared mocha setup, required via package.json's "test"/"coverage" scripts
 * (`--require tests/common`). Exposes the globals every test file under
 * tests/*.js already assumes exist (`assert`, `Epayco`, `epayco`).
 *
 * NOTE: package.json used to point this at `test/common` (singular `test/`),
 * which doesn't exist in this repo (the directory is `tests/`, plural) -- so
 * `npm test` was failing with "epayco is not defined"/"assert is not
 * defined" for every suite before this file existed. First introduced during
 * SDK-1352's development so `npm test` could actually validate the new cash
 * flow, but reverted out of that PR at the time per an explicit request to
 * keep tests/ untouched there; restored here as part of SDK-1354 because
 * without it `npm test`/`npm run coverage` cannot even load a single test
 * file (MODULE_NOT_FOUND), which blocks validating this ticket's own new
 * tests/safetypay.js -- unrelated to the SafetyPay migration itself
 * otherwise, this is just the shared scaffolding every suite needs to run.
 */
global.assert = require('better-assert');

var Epayco = require('../lib');
global.Epayco = Epayco;

global.epayco = new Epayco({
    apiKey: process.env.EPAYCO_TEST_PUBLIC_KEY || 'epayco-dummy-public-key-00000000',
    // Exactly 32 UTF-8 bytes: lib/gateways/msTransactionCash.js's/
    // msTransactionBank.js's/msTransactionSafetypay.js's assertValidPrivateKey()
    // requires this (AES-256 key length) for every encryptBody()/encryptValue()
    // call the ms-transaction tests exercise.
    // Deliberately not shaped like a real provider's secret-key format
    // (e.g. "sk_..."/"pk_...") -- an earlier version of this fixture used
    // that shape and GitHub's push protection flagged it as a Stripe test
    // key false positive.
    privateKey: process.env.EPAYCO_TEST_PRIVATE_KEY || 'epayco-dummy-private-key-test000',
    lang: 'ES',
    test: true
});

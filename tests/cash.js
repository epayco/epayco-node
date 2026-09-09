var nock = require('nock');
var msTransactionCash = require('../lib/gateways/msTransactionCash');

describe('Cash', function() {

    afterEach(function() {
        nock.cleanAll();
    });

    describe('#create', function() {

        it('throws EpaycoError 109 for an unsupported cash type', function() {
            var threw = false;
            try {
                epayco.cash.create('unsupported_type', {});
            } catch (e) {
                threw = true;
                assert(/109/.test(e.message));
            }
            assert(threw);
        });

        it('maps every supported legacy type to its verified ms-transaction franchise code', function() {
            assert(msTransactionCash.FRANCHISE_MAP.efecty === 'EF');
            assert(msTransactionCash.FRANCHISE_MAP.baloto === 'BA');
            assert(msTransactionCash.FRANCHISE_MAP.gana === 'GA');
            assert(msTransactionCash.FRANCHISE_MAP.redservi === 'RS');
            assert(msTransactionCash.FRANCHISE_MAP.puntored === 'PR');
            assert(msTransactionCash.FRANCHISE_MAP.sured === 'SR');
        });

        it('builds the ms-transaction body from today\'s legacy option names', function() {
            var cash_info = {
                invoice: '1472050778',
                description: 'pay test',
                value: '20000',
                tax: '0',
                tax_base: '0',
                currency: 'COP',
                doc_type: 'CC',
                doc_number: '10358519',
                name: 'testing',
                last_name: 'PAYCO',
                email: 'test@mailinator.com',
                cell_phone: '3010000001',
                city: 'Medellin',
                ip: '190.0.0.1',
                url_response: 'https://example.com/response',
                url_confirmation: 'https://example.com/confirmation',
                method_confirmation: 'GET',
                extra1: 'foo'
            };

            var body = msTransactionCash.buildBody(epayco, 'GA', cash_info);

            assert(body.paymentMethod === 'CASH');
            assert(body.paymentMethodData.franchise === 'GA');
            assert(body.invoice === cash_info.invoice);
            assert(body.description === cash_info.description);
            assert(body.amount === cash_info.value);
            assert(body.documentType === cash_info.doc_type);
            assert(body.document === cash_info.doc_number);
            assert(body.names === cash_info.name);
            assert(body.lastNames === cash_info.last_name);
            assert(body.email === cash_info.email);
            assert(body.cellphone === cash_info.cell_phone);
            assert(body.city === cash_info.city);
            assert(body.ip === cash_info.ip);
            assert(body.responseUrl === cash_info.url_response);
            assert(body.confirmationUrl === cash_info.url_confirmation);
            assert(body.confirmationMethod === cash_info.method_confirmation);
            assert(body.publicKey === epayco.apiKey);
            assert(body.extras.extra1 === 'foo');
            assert(body.testMode === true);
        });

        it('encrypts every leaf value except publicKey, and adds i/language', function() {
            var body = msTransactionCash.buildBody(epayco, 'EF', {
                invoice: '123',
                value: '20000',
                doc_type: 'CC',
                doc_number: '10358519'
            });
            var encrypted = msTransactionCash.encryptBody(body, epayco.privateKey);

            assert(encrypted.publicKey === epayco.apiKey);
            assert(typeof encrypted.invoice === 'string');
            assert(encrypted.invoice !== body.invoice);
            assert(typeof encrypted.paymentMethodData.franchise === 'string');
            assert(encrypted.paymentMethodData.franchise !== body.paymentMethodData.franchise);
            assert(typeof encrypted.i === 'string');
            assert(typeof encrypted.language === 'string');
            // null/undefined leaves (e.g. unset "city") must be omitted, not sent as "null"
            assert(encrypted.city === undefined);
        });

        it('builds a splitPayment block for a Split 1-1 request (no split_receivers)', function() {
            var split_cash_info = {
                invoice: '1472050778',
                value: '20000',
                doc_type: 'CC',
                doc_number: '10358519',
                splitpayment: 'true',
                split_app_id: 'P_CUST_ID_CLIENTE APPLICATION',
                split_merchant_id: 'P_CUST_ID_CLIENTE COMMERCE',
                split_type: '02',
                split_primary_receiver: 'P_CUST_ID_CLIENTE APPLICATION',
                split_primary_receiver_fee: '10'
            };

            var body = msTransactionCash.buildBody(epayco, 'EF', split_cash_info);

            assert(body.splitPayment);
            assert(body.splitPayment.splitMethod === 'multiple');
            assert(body.splitPayment.splitAppId === split_cash_info.split_app_id);
            assert(body.splitPayment.splitMerchantId === split_cash_info.split_merchant_id);
            assert(body.splitPayment.splitType === '02');
            assert(body.splitPayment.splitPrimaryReceiver === split_cash_info.split_primary_receiver);
            assert(body.splitPayment.splitPrimaryReceiverFee === '10');
            // no split_rule/split_receivers passed for the 1-1 case: defaults kick in,
            // but splitReceivers must still be present as [] (not omitted) --
            // ms-transaction's backend reads splitPayment.splitReceivers
            // unconditionally and 500s ("Undefined property:
            // stdClass::$splitReceivers") if the key is missing entirely,
            // mirroring Python's CashRequestMapper
            // (split_info.get("split_receivers", [])).
            assert(body.splitPayment.splitRule === 'multiple');
            assert('splitReceivers' in body.splitPayment);
            assert(Array.isArray(body.splitPayment.splitReceivers));
            assert(body.splitPayment.splitReceivers.length === 0);
            assert(body.paymentMethodData.credits === undefined);

            var encrypted = msTransactionCash.encryptBody(body, epayco.privateKey);
            assert(typeof encrypted.splitPayment.splitAppId === 'string');
            assert(encrypted.splitPayment.splitAppId !== body.splitPayment.splitAppId);
            // splitReceivers stays present (as an encrypted "[]") once encrypted too
            assert(typeof encrypted.splitPayment.splitReceivers === 'string');
        });

        it('builds a splitPayment block for a Split Multiple request (JSON-string split_receivers + credits)', function() {
            var receivers = [
                { id: 'P_CUST_ID_CLIENTE 1ST RECEIVER', total: '58000', iva: '8000', baseTax: '50000', fee: '10' },
                { id: 'P_CUST_ID_CLIENTE 2ND RECEIVER', total: '58000', iva: '8000', baseTax: '50000', fee: '10' }
            ];
            var split_payment_info = {
                invoice: '1472050778',
                value: '20000',
                doc_type: 'CC',
                doc_number: '10358519',
                splitpayment: 'true',
                split_app_id: 'P_CUST_ID_CLIENTE APPLICATION',
                split_merchant_id: 'P_CUST_ID_CLIENTE COMMERCE',
                split_type: '02',
                split_primary_receiver: 'P_CUST_ID_CLIENTE APPLICATION',
                split_primary_receiver_fee: '0',
                split_rule: 'multiple',
                split_receivers: JSON.stringify(receivers),
                credits: { number: '1' }
            };

            var body = msTransactionCash.buildBody(epayco, 'EF', split_payment_info);

            assert(body.splitPayment);
            assert(body.splitPayment.splitMethod === 'multiple');
            assert(body.splitPayment.splitRule === 'multiple');
            assert(body.splitPayment.splitReceivers.length === 2);
            assert(body.splitPayment.splitReceivers[0].id === receivers[0].id);
            assert(body.splitPayment.splitReceivers[0].baseTax === receivers[0].baseTax);
            // credits is a sibling of franchise inside paymentMethodData, not inside splitPayment
            assert(body.paymentMethodData.credits.number === '1');
            assert(body.splitPayment.credits === undefined);

            // also accept an already-parsed array (not just a JSON string) for split_receivers
            var bodyFromArray = msTransactionCash.buildBody(epayco, 'EF', Object.assign({}, split_payment_info, { split_receivers: receivers }));
            assert(bodyFromArray.splitPayment.splitReceivers.length === 2);

            var encrypted = msTransactionCash.encryptBody(body, epayco.privateKey);
            assert(typeof encrypted.splitPayment.splitReceivers === 'string');
            // credits is a nested object, so encryptObject recurses leaf-by-leaf
            // (same as any other nested object in the body, e.g. paymentMethodData itself)
            assert(typeof encrypted.paymentMethodData.credits.number === 'string');
            assert(encrypted.paymentMethodData.credits.number !== body.paymentMethodData.credits.number);
        });

        it('does not add a splitPayment block when no split-payment options are passed', function() {
            var body = msTransactionCash.buildBody(epayco, 'EF', {
                invoice: '1',
                value: '1000'
            });
            assert(body.splitPayment === undefined);
        });

        it('creates a cash transaction against the ms-transaction endpoints (mocked)', function(done) {
            nock('https://eks-apify-service.epayco.io')
                .post('/login')
                .reply(200, { token: 'fake.jwt.token' });

            nock('https://apiflow.epayco.io')
                .post('/payment/api/v1/transactions')
                .reply(200, {
                    success: true,
                    message: 'Transacción creada exitosamente',
                    data: {
                        refPayco: 1000008905,
                        invoice: '1472050778',
                        status: 'Pendiente',
                        franchise: 'GA',
                        nameBank: 'GANA'
                    }
                });

            var cash_info = {
                invoice: '1472050778',
                description: 'pay test',
                value: '20000',
                tax: '0',
                tax_base: '0',
                currency: 'COP',
                doc_type: 'CC',
                doc_number: '10358519',
                name: 'testing',
                last_name: 'PAYCO',
                email: 'test@mailinator.com',
                cell_phone: '3010000001',
                city: 'Medellin',
                ip: '190.0.0.1',
                url_response: 'https://example.com/response',
                url_confirmation: 'https://example.com/confirmation',
                method_confirmation: 'GET'
            };

            epayco.cash.create('gana', cash_info)
                .then(function(cash) {
                    assert(cash);
                    assert(cash.success === true);
                    assert(cash.data.refPayco === 1000008905);
                    done();
                })
                .catch(done);
        });

        it('resolves with the gateway\'s error response as-is instead of rejecting', function(done) {
            nock('https://eks-apify-service.epayco.io')
                .post('/login')
                .reply(200, { token: 'fake.jwt.token' });

            nock('https://apiflow.epayco.io')
                .post('/payment/api/v1/transactions')
                .reply(400, { success: false, message: 'Invalid franchise' });

            epayco.cash.create('efecty', { invoice: '1', value: '1000', ip: '190.0.0.1' })
                .then(function(cash) {
                    assert(cash);
                    assert(cash.success === false);
                    done();
                })
                .catch(done);
        });
    });

    describe('#Retrieve', function() {
        it('retrieves a cash transaction by refPayco (mocked)', function(done) {
            nock('https://eks-apify-service.epayco.io')
                .post('/login')
                .reply(200, { token: 'fake.jwt.token' });

            nock('https://apiflow.epayco.io')
                .get('/payment/api/v1/transactions/1000008905')
                .reply(200, {
                    success: true,
                    message: 'ok',
                    data: { refPayco: 1000008905, status: 'Pendiente' }
                });

            epayco.cash.get('1000008905')
                .then(function(cash) {
                    assert(cash);
                    assert(cash.success === true);
                    assert(cash.data.refPayco === 1000008905);
                    done();
                })
                .catch(done);
        });

        // SDK-1352 security review (HIGH): uid/refPayco is concatenated
        // straight into the request path in msTransactionCash.getTransaction,
        // so a malformed value (e.g. forwarded unsanitized from a redirect
        // query string or confirmation callback) must never reach the
        // network -- it should be rejected before even the login() call.
        it('accepts a plain numeric uid (unchanged behavior)', function(done) {
            var loginScope = nock('https://eks-apify-service.epayco.io')
                .post('/login')
                .reply(200, { token: 'fake.jwt.token' });

            var getScope = nock('https://apiflow.epayco.io')
                .get('/payment/api/v1/transactions/1000008905')
                .reply(200, {
                    success: true,
                    message: 'ok',
                    data: { refPayco: 1000008905, status: 'Pendiente' }
                });

            epayco.cash.get('1000008905')
                .then(function(cash) {
                    assert(cash);
                    assert(cash.success === true);
                    assert(loginScope.isDone());
                    assert(getScope.isDone());
                    done();
                })
                .catch(done);
        });

        it('throws before any HTTP call for a malformed uid (path traversal)', function() {
            var loginScope = nock('https://eks-apify-service.epayco.io')
                .post('/login')
                .reply(200, { token: 'fake.jwt.token' });

            var getScope = nock('https://apiflow.epayco.io')
                .get(/\/payment\/api\/v1\/transactions\/.*/)
                .reply(200, { success: true });

            var threw = false;
            try {
                epayco.cash.get('1000008905/../secrets');
            } catch (e) {
                threw = true;
                assert(/103/.test(e.message));
            }
            assert(threw);
            // no request was actually attempted against either mocked host
            assert(!loginScope.isDone());
            assert(!getScope.isDone());
        });

        it('throws before any HTTP call for a malformed uid (query string / non-numeric)', function() {
            var loginScope = nock('https://eks-apify-service.epayco.io')
                .post('/login')
                .reply(200, { token: 'fake.jwt.token' });

            var getScope = nock('https://apiflow.epayco.io')
                .get(/\/payment\/api\/v1\/transactions\/.*/)
                .reply(200, { success: true });

            var threw = false;
            try {
                epayco.cash.get('1000008905?foo=bar');
            } catch (e) {
                threw = true;
                assert(/103/.test(e.message));
            }
            assert(threw);
            assert(!loginScope.isDone());
            assert(!getScope.isDone());
        });
    });

});

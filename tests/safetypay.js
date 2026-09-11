var nock = require('nock');
var msTransactionSafetypay = require('../lib/gateways/msTransactionSafetypay');

describe('Safetypay', function() {

    afterEach(function() {
        nock.cleanAll();
    });

    describe('#buildBody', function() {

        it('builds the ms-transaction body from today\'s legacy option names', function() {
            var safetypay_info = {
                invoice: '1472050778',
                description: 'pay test',
                value: '20000',
                tax: '0',
                tax_base: '0',
                currency: 'COP',
                doc_type: 'CC',
                document: '10358519',
                name: 'testing',
                last_name: 'PAYCO',
                email: 'test@mailinator.com',
                cell_phone: '3010000001',
                city: 'Medellin',
                country: 'CO',
                ip: '190.0.0.1',
                end_date: '2017-12-05',
                url_response: 'https://example.com/response',
                url_confirmation: 'https://example.com/confirmation',
                extra1: 'foo'
            };

            var body = msTransactionSafetypay.buildBody(epayco, safetypay_info);

            assert(body.paymentMethod === 'SP');
            assert(body.invoice === safetypay_info.invoice);
            assert(body.description === safetypay_info.description);
            assert(body.amount === safetypay_info.value);
            assert(body.documentType === safetypay_info.doc_type);
            assert(body.document === safetypay_info.document);
            assert(body.names === safetypay_info.name);
            assert(body.lastNames === safetypay_info.last_name);
            assert(body.email === safetypay_info.email);
            assert(body.cellphone === safetypay_info.cell_phone);
            assert(body.city === safetypay_info.city);
            assert(body.ip === safetypay_info.ip);
            assert(body.responseUrl === safetypay_info.url_response);
            assert(body.confirmationUrl === safetypay_info.url_confirmation);
            // no method_confirmation/metodoconfirmacion passed: defaults to POST
            // (NOT "GET" like Bank's/Cash's buildBody)
            assert(body.confirmationMethod === 'POST');
            assert(body.publicKey === epayco.apiKey);
            assert(body.extras.extra1 === 'foo');
            assert(body.testMode === true);
            // root-level country stays plain ISO alpha-2 ...
            assert(body.country === 'CO');
            // ... while paymentMethodData.country is the ISO alpha-3 SafetyPay needs
            assert(body.paymentMethodData.country === 'COL');
            assert(body.paymentMethodData.expirationDate === safetypay_info.end_date);
            // internal-tracking marker: "P44", matching Bank's/Cash's buildBody
            // (NOT "P43" like the Python SDK's own SafetyPay migration)
            assert(body.extrasEpayco.extra5 === 'P44');
        });

        it('falls back to doc_number when document is not provided', function() {
            var body = msTransactionSafetypay.buildBody(epayco, {
                invoice: '1',
                value: '1000',
                doc_number: '999888777'
            });
            assert(body.document === '999888777');
        });

        it('prefers document over doc_number when both are provided', function() {
            var body = msTransactionSafetypay.buildBody(epayco, {
                invoice: '1',
                value: '1000',
                document: '111',
                doc_number: '222'
            });
            assert(body.document === '111');
        });

        it('defaults confirmationMethod to POST but stays overridable', function() {
            var body = msTransactionSafetypay.buildBody(epayco, {
                invoice: '1',
                value: '1000',
                method_confirmation: 'GET'
            });
            assert(body.confirmationMethod === 'GET');
        });

        it('does not add a splitPayment block when no split-payment options are passed', function() {
            var body = msTransactionSafetypay.buildBody(epayco, {
                invoice: '1',
                value: '1000'
            });
            assert(body.splitPayment === undefined);
        });

        it('builds a splitPayment block for a Split 1-1 request (no split_receivers)', function() {
            var split_info = {
                invoice: '1472050778',
                value: '20000',
                splitpayment: 'true',
                split_app_id: 'P_CUST_ID_CLIENTE APPLICATION',
                split_merchant_id: 'P_CUST_ID_CLIENTE COMMERCE',
                split_type: '02',
                split_primary_receiver: 'P_CUST_ID_CLIENTE APPLICATION',
                split_primary_receiver_fee: '10'
            };

            var body = msTransactionSafetypay.buildBody(epayco, split_info);

            assert(body.splitPayment);
            assert(body.splitPayment.splitMethod === 'multiple');
            assert(body.splitPayment.splitAppId === split_info.split_app_id);
            assert(body.splitPayment.splitMerchantId === split_info.split_merchant_id);
            assert(body.splitPayment.splitType === '02');
            assert(body.splitPayment.splitPrimaryReceiver === split_info.split_primary_receiver);
            assert(body.splitPayment.splitPrimaryReceiverFee === '10');
            assert(body.splitPayment.splitRule === 'multiple');
            assert('splitReceivers' in body.splitPayment);
            assert(Array.isArray(body.splitPayment.splitReceivers));
            assert(body.splitPayment.splitReceivers.length === 0);
        });

        it('builds a splitPayment block for a Split Multiple request (JSON-string split_receivers)', function() {
            var receivers = [
                { id: 'P_CUST_ID_CLIENTE 1ST RECEIVER', total: '58000', iva: '8000', baseTax: '50000', fee: '10' },
                { id: 'P_CUST_ID_CLIENTE 2ND RECEIVER', total: '58000', iva: '8000', baseTax: '50000', fee: '10' }
            ];
            var split_payment_info = {
                invoice: '1472050778',
                value: '20000',
                splitpayment: 'true',
                split_app_id: 'P_CUST_ID_CLIENTE APPLICATION',
                split_merchant_id: 'P_CUST_ID_CLIENTE COMMERCE',
                split_type: '02',
                split_primary_receiver: 'P_CUST_ID_CLIENTE APPLICATION',
                split_primary_receiver_fee: '0',
                split_rule: 'multiple',
                split_receivers: JSON.stringify(receivers)
            };

            var body = msTransactionSafetypay.buildBody(epayco, split_payment_info);

            assert(body.splitPayment);
            assert(body.splitPayment.splitReceivers.length === 2);
            assert(body.splitPayment.splitReceivers[0].id === receivers[0].id);

            // also accept an already-parsed array (not just a JSON string)
            var bodyFromArray = msTransactionSafetypay.buildBody(epayco, Object.assign({}, split_payment_info, { split_receivers: receivers }));
            assert(bodyFromArray.splitPayment.splitReceivers.length === 2);
        });
    });

    describe('#toIsoAlpha3', function() {
        it('maps the verified "CO" -> "COL" entry', function() {
            assert(msTransactionSafetypay.toIsoAlpha3('CO') === 'COL');
        });

        it('falls back to the plain value for any country not in the map', function() {
            assert(msTransactionSafetypay.toIsoAlpha3('PE') === 'PE');
            assert(msTransactionSafetypay.toIsoAlpha3('MX') === 'MX');
        });
    });

    describe('#encryptBody', function() {
        it('encrypts every leaf value except publicKey, and adds i/language', function() {
            var body = msTransactionSafetypay.buildBody(epayco, {
                invoice: '123',
                value: '20000',
                document: '10358519'
            });
            var encrypted = msTransactionSafetypay.encryptBody(body, epayco.privateKey);

            assert(encrypted.publicKey === epayco.apiKey);
            assert(typeof encrypted.invoice === 'string');
            assert(encrypted.invoice !== body.invoice);
            assert(typeof encrypted.paymentMethodData.country === 'string');
            assert(encrypted.paymentMethodData.country !== body.paymentMethodData.country);
            assert(typeof encrypted.i === 'string');
            assert(typeof encrypted.language === 'string');
            // null/undefined leaves (e.g. unset "city") must be omitted, not sent as "null"
            assert(encrypted.city === undefined);
        });
    });

    describe('#mapToLegacyShape', function() {
        it('maps a successful ms-transaction response into the legacy shape', function() {
            var raw = {
                success: true,
                message: 'Transaccion creada exitosamente',
                data: {
                    refPayco: 1000008905,
                    invoice: '1472050778',
                    description: 'pay test',
                    amount: '20000',
                    tax: '0',
                    ico: '0',
                    taxBase: '0',
                    currency: 'COP',
                    status: 'Pendiente',
                    response: 'Pendiente',
                    responseCode: 'P004',
                    authorization: 'auth-123',
                    receipt: 'recibo-456',
                    date: '2026-09-10',
                    city: 'Medellin',
                    extrasEpayco: { extra5: 'P44' },
                    paymentProviderData: { urlPayment: 'https://safetypay.example.com/checkout/abc' }
                }
            };

            var mapped = msTransactionSafetypay.mapToLegacyShape(raw, { country: 'CO' });

            assert(mapped.success === true);
            assert(mapped.titleResponse === 'Ok');
            assert(mapped.textResponse === raw.message);
            assert(mapped.data.refPayco === raw.data.refPayco);
            assert(mapped.data.transactionId === raw.data.refPayco);
            assert(mapped.data.ticketId === raw.data.receipt);
            assert(mapped.data.receipt === raw.data.receipt);
            assert(mapped.data.autorization === raw.data.authorization);
            assert(mapped.data.codResponse === raw.data.responseCode);
            assert(mapped.data.codError === '');
            assert(mapped.data.country === 'CO');
            assert(mapped.data.urlBank === raw.data.paymentProviderData.urlPayment);
            assert(mapped.data.extras_epayco.extra5 === 'P44');
        });

        it('maps a failed ms-transaction response, defaulting missing fields safely', function() {
            var raw = { success: false, message: 'Invalid document', data: {} };
            var mapped = msTransactionSafetypay.mapToLegacyShape(raw, {});

            assert(mapped.success === false);
            assert(mapped.titleResponse === raw.message);
            assert(mapped.data.urlBank === '');
            assert(mapped.data.codResponse === '');
            assert(mapped.data.codError === '');
            assert(mapped.data.country === 'CO');
        });
    });

    describe('#create', function() {
        it('creates a SafetyPay transaction against the ms-transaction endpoints (mocked)', function(done) {
            nock('https://eks-apify-service.epayco.io')
                .post('/login')
                .reply(200, { token: 'fake.jwt.token' });

            nock('https://apiflow.epayco.io')
                .post('/payment/api/v1/transactions')
                .reply(200, {
                    success: true,
                    message: 'Transaccion creada exitosamente',
                    data: {
                        refPayco: 1000008905,
                        invoice: '1472050778',
                        status: 'Pendiente',
                        paymentProviderData: { urlPayment: 'https://safetypay.example.com/checkout/abc' }
                    }
                });

            var safetypay_info = {
                invoice: '1472050778',
                description: 'pay test',
                value: '20000',
                document: '10358519',
                name: 'testing',
                last_name: 'PAYCO',
                email: 'test@mailinator.com',
                country: 'CO',
                ip: '190.0.0.1'
            };

            epayco.safetypay.create(safetypay_info)
                .then(function(safetypay) {
                    assert(safetypay);
                    assert(safetypay.success === true);
                    assert(safetypay.data.refPayco === 1000008905);
                    assert(safetypay.data.urlBank === 'https://safetypay.example.com/checkout/abc');
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
                .reply(400, { success: false, message: 'Invalid document' });

            epayco.safetypay.create({ invoice: '1', value: '1000', ip: '190.0.0.1' })
                .then(function(safetypay) {
                    assert(safetypay);
                    assert(safetypay.success === false);
                    done();
                })
                .catch(done);
        });

        // SDK-1354: usesLegacyFlow('safetypay') opt-out mirrors bank.js's/cash.js's
        // own transactionMethods opt-out (SDK-1355/SDK-1352) -- a merchant passing
        // transactionMethods: ["safetypay"] must still hit the legacy apify
        // POST /payment/process/safetypay endpoint, unchanged, instead of the new
        // ms-transaction generic transactions endpoint.
        it('uses the legacy apify flow when transactionMethods opts safetypay out', function(done) {
            var legacyEpayco = new Epayco({
                apiKey: epayco.apiKey,
                privateKey: epayco.privateKey,
                lang: 'ES',
                test: true,
                transactionMethods: ['safetypay']
            });

            nock('https://eks-apify-service.epayco.io')
                .post('/login')
                .reply(200, { token: 'fake.jwt.token' });

            var legacyScope = nock('https://eks-apify-service.epayco.io')
                .post('/payment/process/safetypay')
                .reply(200, { success: true, titleResponse: 'Ok' });

            var msTransactionScope = nock('https://apiflow.epayco.io')
                .post('/payment/api/v1/transactions')
                .reply(200, { success: true });

            legacyEpayco.safetypay.create({ invoice: '1', value: '1000', ip: '190.0.0.1' })
                .then(function() {
                    assert(legacyScope.isDone());
                    assert(!msTransactionScope.isDone());
                    done();
                })
                .catch(done);
        });
    });

    describe('#Retrieve', function() {
        it('retrieves a SafetyPay transaction by refPayco (mocked)', function(done) {
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

            epayco.safetypay.get('1000008905')
                .then(function(safetypay) {
                    assert(safetypay);
                    assert(safetypay.success === true);
                    assert(safetypay.data.refPayco === 1000008905);
                    done();
                })
                .catch(done);
        });

        // .get() is new in SDK-1354 (the pre-SDK-1354 legacy apify flow never had
        // a query method for SafetyPay), so there is no transactionMethods
        // opt-out for it -- it always goes through ms-transaction, even for a
        // merchant that opted "safetypay" out of the new create() flow.
        it('always uses the ms-transaction flow, even when transactionMethods opts safetypay out', function(done) {
            var legacyEpayco = new Epayco({
                apiKey: epayco.apiKey,
                privateKey: epayco.privateKey,
                lang: 'ES',
                test: true,
                transactionMethods: ['safetypay']
            });

            nock('https://eks-apify-service.epayco.io')
                .post('/login')
                .reply(200, { token: 'fake.jwt.token' });

            var msTransactionScope = nock('https://apiflow.epayco.io')
                .get('/payment/api/v1/transactions/1000008905')
                .reply(200, { success: true, data: { refPayco: 1000008905 } });

            legacyEpayco.safetypay.get('1000008905')
                .then(function(safetypay) {
                    assert(safetypay.success === true);
                    assert(msTransactionScope.isDone());
                    done();
                })
                .catch(done);
        });

        // SDK-1354 security review precedent (see msTransactionBank.js/
        // msTransactionCash.js's own equivalent tests): refPayco is
        // concatenated straight into the request path in
        // msTransactionSafetypay.getTransaction, so a malformed value must
        // never reach the network -- it should be rejected before even the
        // login() call.
        it('throws before any HTTP call for a malformed uid (path traversal)', function() {
            var loginScope = nock('https://eks-apify-service.epayco.io')
                .post('/login')
                .reply(200, { token: 'fake.jwt.token' });

            var getScope = nock('https://apiflow.epayco.io')
                .get(/\/payment\/api\/v1\/transactions\/.*/)
                .reply(200, { success: true });

            var threw = false;
            try {
                epayco.safetypay.get('1000008905/../secrets');
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

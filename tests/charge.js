var nock = require('nock');

describe('Charge', function() {

    afterEach(function() {
        nock.cleanAll();
    });

    describe('#create', function() {
        it('Create charge', function(done) {
            // charge.create() uses sw=false, so both auth and the payload
            // POST land on BASE_URL (api.secure.payco.co).
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .post('/payment/v1/charge/create')
                .reply(200, { success: true, data: { ref_payco: '9999999', estado: 'Aceptada' } });

            var payment_info = {
                token_card: "token_id",
                customer_id: "customer_id",
                doc_type: "CC",
                doc_number: "1035851980",
                name: "John",
                last_name: "Doe",
                email: "example@email.com",
                bill: "OR-1234",
                description: "Test Payment",
                value: "116000",
                tax: "16000",
                tax_base: "100000",
                currency: "COP",
                dues: "12"
            }
            epayco.charge.create(payment_info)
                .then(function(charge) {
                    assert(charge);
                    assert(charge.success === true);
                    done();
                })
                .catch(done);
        });
    });

    describe('#Retrieve', function() {
        it('Retrieve charge', function(done) {
            // charge.get() uses sw=true (BASE_URL_SECURE for the payload),
            // but authent() always targets BASE_URL regardless of sw.
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://secure.payco.co')
                .get(/\/restpagos\/transaction\/response\.json\?ref_payco=.*/)
                .reply(200, { success: true, data: { ref_payco: '9999999', estado: 'Aceptada' } });

            epayco.charge.get("transaction_id")
                .then(function(charge) {
                    assert(charge);
                    assert(charge.success === true);
                    done();
                })
                .catch(done);
        });
    });

});

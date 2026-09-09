var nock = require('nock');

describe('Bank', function() {

    afterEach(function() {
        nock.cleanAll();
    });

    describe('#create', function() {
        it('Create pse transaction', function(done) {
            // lib/resources/index.js's Resource.prototype.request always
            // authenticates against BASE_URL (api.secure.payco.co) first --
            // regardless of the `sw` flag that routes the actual payload to
            // BASE_URL_SECURE (secure.payco.co) below -- then resolves the
            // caller's IP unless `card` is passed, before finally sending
            // the (encrypted, since sw=true here) request.
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://secure.payco.co')
                .post('/restpagos/pagos/debitos.json')
                .reply(200, { estado: 'Pendiente', ref_payco: '9999999' });

            var pse_info = {
                bank: "1022",
                invoice: "1472050778",
                description: "pay test",
                value: "10000",
                tax: "0",
                tax_base: "0",
                currency: "COP",
                type_person: "0",
                doc_type: "CC",
                doc_number: "10358519",
                name: "testing",
                last_name: "PAYCO",
                email: "no-responder@payco.co",
                country: "CO",
                cell_phone: "3010000001",
                url_response: "https:/secure.payco.co/restpagos/testRest/endpagopse.php",
                url_confirmation: "https:/secure.payco.co/restpagos/testRest/endpagopse.php",
                method_confirmation: "GET",
            }
            epayco.bank.create(pse_info)
                .then(function(bank) {
                    assert(bank);
                    assert(bank.estado === 'Pendiente');
                    done();
                })
                .catch(done);
        });
    });

    describe('#Retrieve', function() {
        it('Retrieve pse', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            // bank.get() routes through BASE_URL_SECURE (sw=true) and embeds
            // transactionID/public_key directly in the querystring.
            nock('https://secure.payco.co')
                .get(/\/restpagos\/pse\/transactioninfomation\.json\?transactionID=.*/)
                .reply(200, { estado: 'Pendiente', ref_payco: '9999999' });

            epayco.bank.get("transaction_id")
                .then(function(bank) {
                    assert(bank);
                    assert(bank.estado === 'Pendiente');
                    done();
                })
                .catch(done);
        });
    });

});

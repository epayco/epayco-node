var nock = require('nock');

describe('Subscriptions', function() {

    afterEach(function() {
        nock.cleanAll();
    });

    describe('#create', function() {
        it('Create subscription', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .post('/recurring/v1/subscription/create')
                .reply(200, { success: true, data: { id_subscription: 'id_subscription' } });

            var subscription_info = {
                id_plan: "-id_plan",
                customer: "id_customer",
                token_card: "id_token",
                doc_type: "CC",
                doc_number: "5234567"
            }
            epayco.subscriptions.create(subscription_info)
                .then(function(subscription) {
                    assert(subscription);
                    assert(subscription.success === true);
                    done();
                })
                .catch(done);
        });
    });

    describe('#Retrieve', function() {
        it('Retrieve subscription', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .get('/recurring/v1/subscription/id_subscription/' + epayco.apiKey)
                .reply(200, { success: true, data: { id_subscription: 'id_subscription' } });

            epayco.subscriptions.get("id_subscription")
                .then(function(subscription) {
                    assert(subscription);
                    assert(subscription.success === true);
                    done();
                })
                .catch(done);
        });
    });

    describe('#List', function() {
        it('List subscriptions', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .get('/recurring/v1/subscriptions/' + epayco.apiKey)
                .reply(200, { success: true, data: [] });

            epayco.subscriptions.list()
                .then(function(subscriptions) {
                    assert(subscriptions);
                    assert(subscriptions.success === true);
                    done();
                })
                .catch(done);
        });
    });

    describe('#Cancel', function() {
        it('Cancel subscription', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .post('/recurring/v1/subscription/cancel')
                .reply(200, { success: true, data: { id_subscription: 'id_subscription', status: 'Cancelada' } });

            epayco.subscriptions.cancel("id_subscription")
                .then(function(subscription) {
                    assert(subscription);
                    assert(subscription.success === true);
                    done();
                })
                .catch(done);
        });
    });

    describe('#Pay', function() {
        it('Pay subscription', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .post('/payment/v1/charge/subscription/create')
                .reply(200, { success: true, data: { ref_payco: '9999999', estado: 'Aceptada' } });

            var subscription_info = {
                id_plan: "-id_plan",
                customer: "id_customer",
                token_card: "id_token",
                doc_type: "CC",
                doc_number: "5234567"
            }
            epayco.subscriptions.charge(subscription_info)
                .then(function(subscription) {
                    assert(subscription);
                    assert(subscription.success === true);
                    done();
                })
                .catch(done);
        });
    });

});

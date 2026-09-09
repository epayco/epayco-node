var nock = require('nock');

describe('Customers', function() {

    afterEach(function() {
        nock.cleanAll();
    });

    describe('#create', function() {
        it('Create customer', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .post('/payment/v1/customer/create')
                .reply(200, { success: true, data: { customerId: 'id_customer' } });

            var customer_info = {
                token_card: "toke_id",
                name: "Joe Doe",
                email: "joe@payco.co",
                phone: "3005234321",
                default: true
            }
            epayco.customers.create(customer_info)
                .then(function(customer) {
                    assert(customer);
                    assert(customer.success === true);
                    done();
                })
                .catch(done);
        });
    });

    describe('#Retrieve', function() {
        it('Retrieve customer', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            // customers.get() builds /payment/v1/customer/<apiKey>/<uid>
            nock('https://api.secure.payco.co')
                .get('/payment/v1/customer/' + epayco.apiKey + '/id_customer')
                .reply(200, { success: true, data: { customerId: 'id_customer' } });

            epayco.customers.get("id_customer")
                .then(function(customer) {
                    assert(customer);
                    assert(customer.success === true);
                    done();
                })
                .catch(done);
        });
    });

    describe('#List', function() {
        it('List customers', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            // customers.list() passes card=true internally, which skips the
            // getIp() call entirely -- unlike every other method here.
            nock('https://api.secure.payco.co')
                .get('/payment/v1/customers')
                .reply(200, { success: true, data: [] });

            epayco.customers.list()
                .then(function(customers) {
                    assert(customers);
                    assert(customers.success === true);
                    done();
                })
                .catch(done);
        });
    });

    describe('#Update', function() {
        it('Update customer', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .post('/payment/v1/customer/edit/' + epayco.apiKey + '/id_customer')
                .reply(200, { success: true, data: { customerId: 'id_customer', name: 'Alex' } });

            var update_customer_info = {
                name: "Alex"
            }
            epayco.customers.update("id_customer", update_customer_info)
                .then(function(customer) {
                    assert(customer);
                    assert(customer.success === true);
                    done();
                })
                .catch(done);
        });
    });

});

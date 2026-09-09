var nock = require('nock');

describe('Plans', function() {

    afterEach(function() {
        nock.cleanAll();
    });

    describe('#create', function() {
        it('Create plan', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .post('/recurring/v1/plan/create')
                .reply(200, { success: true, data: { id_plan: 'coursereact' } });

            var plan_info = {
                id_plan: "coursereact",
                name: "Course react js",
                description: "Course react and redux",
                amount: 30000,
                currency: "cop",
                interval: "month",
                interval_count: 1,
                trial_days: 30
            }
            epayco.plans.create(plan_info)
                .then(function(plan) {
                    assert(plan);
                    assert(plan.success === true);
                    done();
                })
                .catch(done);
        });
    });

    describe('#Retrieve', function() {
        it('Retrieve plan', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .get('/recurring/v1/plan/' + epayco.apiKey + '/id_plan')
                .reply(200, { success: true, data: { id_plan: 'id_plan' } });

            epayco.plans.get("id_plan")
                .then(function(plan) {
                    assert(plan);
                    assert(plan.success === true);
                    done();
                })
                .catch(done);
        });
    });

    describe('#List', function() {
        it('List plans', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .get('/recurring/v1/plans/' + epayco.apiKey)
                .reply(200, { success: true, data: [] });

            epayco.plans.list()
                .then(function(plans) {
                    assert(plans);
                    assert(plans.success === true);
                    done();
                })
                .catch(done);
        });
    });

    describe('#Remove', function() {
        it('Remove plan', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .post('/recurring/v1/plan/remove/' + epayco.apiKey + '/id_plan')
                .reply(200, { success: true });

            epayco.plans.delete("id_plan")
                .then(function(plan) {
                    assert(plan);
                    assert(plan.success === true);
                    done();
                })
                .catch(done);
        });
    });

});

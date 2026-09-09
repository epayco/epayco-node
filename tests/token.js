var nock = require('nock');

describe('Token', function() {

    afterEach(function() {
        nock.cleanAll();
    });

    describe('#create', function() {
        it('Create token card', function(done) {
            nock('https://api.secure.payco.co')
                .post('/v1/auth/login')
                .reply(200, { bearer_token: 'fake.jwt.token' });

            nock('https://api.ipify.org')
                .get('/?format=json')
                .reply(200, { ip: '190.0.0.1' });

            nock('https://api.secure.payco.co')
                .post('/v1/tokens')
                .reply(200, { success: true, id: 'tok_fake_0000000000' });

            var credit_info = {
                "card[number]": "4575623182290326",
                "card[exp_year]": "2017",
                "card[exp_month]": "07",
                "card[cvc]": "123"
            }
            epayco.token.create(credit_info)
                .then(function(token) {
                    assert(token);
                    assert(token.success === true);
                    done();
                })
                .catch(done);
        });
    });

});

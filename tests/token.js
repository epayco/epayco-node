describe('Token', function() {

    describe('#create', function() {
        it('Create token card', function(done) {
            var credit_info = {
                "card[number]": "4575623182290326",
                "card[exp_year]": "2017",
                "card[exp_month]": "07",
                "card[cvc]": "123"
            }
            epayco.token.create(credit_info)
                .then(function(token) {
                    assert(token);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

});

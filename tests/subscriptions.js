describe('Subscriptions', function() {

    describe('#create', function() {
        it('Create subscription', function(done) {
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
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#Retrieve', function() {
        it('Retrieve subscription', function(done) {
            epayco.subscriptions.get("id_subscription")
                .then(function(subscription) {
                    assert(subscription);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#List', function() {
        it('List subscriptions', function(done) {
            epayco.subscriptions.list()
                .then(function(subscriptions) {
                    assert(subscriptions);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#Cancel', function() {
        it('Cancel subscription', function(done) {
            epayco.subscriptions.cancel("id_subscription")
                .then(function(subscription) {
                    assert(subscription);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#Pay', function() {
        it('Pay subscription', function(done) {
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
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

});

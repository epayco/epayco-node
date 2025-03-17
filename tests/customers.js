describe('Customers', function() {

    describe('#create', function() {
        it('Create customer', function(done) {
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
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#Retrieve', function() {
        it('Retrieve customer', function(done) {
            epayco.customers.get("id_customer")
                .then(function(customer) {
                    assert(customer);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#List', function() {
        it('List customers', function(done) {
            epayco.customers.list()
                .then(function(customers) {
                    assert(customers);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#Update', function() {
        it('Update customer', function(done) {
            var update_customer_info = {
                name: "Alex"
            }
            epayco.customers.update("id_customer", update_customer_info)
                .then(function(customer) {
                    assert(customer);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

});

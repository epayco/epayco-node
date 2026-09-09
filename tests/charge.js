describe('Charge', function() {

    describe('#create', function() {
        it('Create charge', function(done) {
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
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#Retrieve', function() {
        it('Retrieve charge', function(done) {
            epayco.charge.get("transaction_id")
                .then(function(charge) {
                    assert(charge);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

});

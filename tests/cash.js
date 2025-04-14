describe('Cash', function() {

    describe('#create', function() {
        it('Create cash transaction', function(done) {
            var cash_info = {
                invoice: "1472050778",
                description: "pay test",
                value: "20000",
                tax: "0",
                tax_base: "0",
                currency: "COP",
                type_person: "0",
                doc_type: "CC",
                doc_number: "10358519",
                name: "testing",
                last_name: "PAYCO",
                email: "test@mailinator.com",
                cell_phone: "3010000001",
                end_date: "2017-12-05",
                url_response: "https:/secure.payco.co/restpagos/testRest/endpagopse.php",
                url_confirmation: "https:/secure.payco.co/restpagos/testRest/endpagopse.php",
                method_confirmation: "GET",
            }
            epayco.cash.create("efecty", cash_info)
                .then(function(cash) {
                    assert(cash);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#Retrieve', function() {
        it('Retrieve cash', function(done) {
            epayco.cash.get("transaction_id")
                .then(function(cash) {
                    assert(cash);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

});

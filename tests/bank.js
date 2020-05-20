describe('Bank', function() {

    describe('#create', function() {
        it('Create pse transaction', function(done) {
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
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#Retrieve', function() {
        it('Retrieve pse', function(done) {
            epayco.bank.get("transaction_id")
                .then(function(bank) {
                    assert(bank);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#BankList', function() {
        it('Retrieve bank list PSE', function(done) {
            epayco.bank.bankList()
                .then(function(banks) {
                    assert(banks);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

});

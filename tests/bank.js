describe("Bank", () => {
  describe("#create", () => {
    it("Create pse transaction", (done) => {
      const pse_info = {
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
        url_response:
          "https:/secure.payco.co/restpagos/testRest/endpagopse.php",
        url_confirmation:
          "https:/secure.payco.co/restpagos/testRest/endpagopse.php",
        method_confirmation: "GET",
      };
      epayco.bank
        .create(pse_info)
        .then((bank) => {
          assert(bank);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });

  describe("#Retrieve", () => {
    it("Retrieve pse", (done) => {
      epayco.bank
        .get("transaction_id")
        .then((bank) => {
          assert(bank);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });
});

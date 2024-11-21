describe("Charge", () => {
  describe("#create", () => {
    it("Create charge", (done) => {
      const payment_info = {
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
        dues: "12",
      };
      epayco.charge
        .create(payment_info)
        .then((charge) => {
          assert(charge);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });

  describe("#Retrieve", () => {
    it("Retrieve charge", (done) => {
      epayco.charge
        .get("transaction_id")
        .then((charge) => {
          assert(charge);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });
});

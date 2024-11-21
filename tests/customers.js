describe("Customers", () => {
  describe("#create", () => {
    it("Create customer", (done) => {
      const customer_info = {
        token_card: "toke_id",
        name: "Joe Doe",
        email: "joe@payco.co",
        phone: "3005234321",
        default: true,
      };
      epayco.customers
        .create(customer_info)
        .then((customer) => {
          assert(customer);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });

  describe("#Retrieve", () => {
    it("Retrieve customer", (done) => {
      epayco.customers
        .get("id_customer")
        .then((customer) => {
          assert(customer);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });

  describe("#List", () => {
    it("List customers", (done) => {
      epayco.customers
        .list()
        .then((customers) => {
          assert(customers);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });

  describe("#Update", () => {
    it("Update customer", (done) => {
      const update_customer_info = {
        name: "Alex",
      };
      epayco.customers
        .update("id_customer", update_customer_info)
        .then((customer) => {
          assert(customer);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });
});

describe("Subscriptions", () => {
  describe("#create", () => {
    it("Create subscription", (done) => {
      const subscription_info = {
        id_plan: "-id_plan",
        customer: "id_customer",
        token_card: "id_token",
        doc_type: "CC",
        doc_number: "5234567",
      };
      epayco.subscriptions
        .create(subscription_info)
        .then((subscription) => {
          assert(subscription);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });

  describe("#Retrieve", () => {
    it("Retrieve subscription", (done) => {
      epayco.subscriptions
        .get("id_subscription")
        .then((subscription) => {
          assert(subscription);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });

  describe("#List", () => {
    it("List subscriptions", (done) => {
      epayco.subscriptions
        .list()
        .then((subscriptions) => {
          assert(subscriptions);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });

  describe("#Cancel", () => {
    it("Cancel subscription", (done) => {
      epayco.subscriptions
        .cancel("id_subscription")
        .then((subscription) => {
          assert(subscription);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });

  describe("#Pay", () => {
    it("Pay subscription", (done) => {
      const subscription_info = {
        id_plan: "-id_plan",
        customer: "id_customer",
        token_card: "id_token",
        doc_type: "CC",
        doc_number: "5234567",
      };
      epayco.subscriptions
        .charge(subscription_info)
        .then((subscription) => {
          assert(subscription);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });
});

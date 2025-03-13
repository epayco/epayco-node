describe("Plans", () => {
  describe("#create", () => {
    it("Create plan", (done) => {
      const plan_info = {
        id_plan: "coursereact",
        name: "Course react js",
        description: "Course react and redux",
        amount: 30000,
        currency: "cop",
        interval: "month",
        interval_count: 1,
        trial_days: 30,
      };
      epayco.plans
        .create(plan_info)
        .then((plan) => {
          assert(plan);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });

  describe("#Retrieve", () => {
    it("Retrieve plan", (done) => {
      epayco.plans
        .get("id_plan")
        .then((plan) => {
          assert(plan);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });

  describe("#List", () => {
    it("List plans", (done) => {
      epayco.plans
        .list()
        .then((plans) => {
          assert(plans);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });

  describe("#Remove", () => {
    it("Remove plan", (done) => {
      epayco.plans
        .delete("id_plan")
        .then((plan) => {
          assert(plan);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });
});

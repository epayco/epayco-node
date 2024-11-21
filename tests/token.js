describe("Token", () => {
  describe("#create", () => {
    it("Create token card", (done) => {
      const credit_info = {
        "card[number]": "4575623182290326",
        "card[exp_year]": "2017",
        "card[exp_month]": "07",
        "card[cvc]": "123",
      };
      epayco.token
        .create(credit_info)
        .then((token) => {
          assert(token);
        })
        .catch((err) => {
          console.log(`err: ${err}`);
        });
    });
  });
});

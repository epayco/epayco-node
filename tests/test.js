describe("Epayco", () => {
  describe("Constructor", () => {
    it("Refuse to initialize without an apikey", (done) => {
      try {
        const epayco = Epayco();
      } catch (e) {
        assert(e);
        done();
      }
    });
  });
});

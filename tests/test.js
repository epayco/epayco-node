describe('Epayco', function() {
    describe('Constructor', function() {
        it('Refuse to initialize without an apikey', function(done) {
            try {
                var epayco = Epayco();
            } catch (e) {
                assert(e);
                done();
            }
        });
    });
});

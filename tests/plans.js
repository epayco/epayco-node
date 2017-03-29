describe('Plans', function() {

    describe('#create', function() {
        it('Create plan', function(done) {
            var plan_info = {
                id_plan: "coursereact",
                name: "Course react js",
                description: "Course react and redux",
                amount: 30000,
                currency: "cop",
                interval: "month",
                interval_count: 1,
                trial_days: 30
            }
            epayco.plans.create(plan_info)
                .then(function(plan) {
                    assert(plan);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#Retrieve', function() {
        it('Retrieve plan', function(done) {
            epayco.plans.get("id_plan")
                .then(function(plan) {
                    assert(plan);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#List', function() {
        it('List plans', function(done) {
            epayco.plans.list()
                .then(function(plans) {
                    assert(plans);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

    describe('#Remove', function() {
        it('Remove plan', function(done) {
            epayco.plans.delete("id_plan")
                .then(function(plan) {
                    assert(plan);
                })
                .catch(function(err) {
                    console.log("err: " + err);
                });
        });
    });

});

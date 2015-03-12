stripeClientId = stripeTest ? Meteor.settings.public.stripe.testClientId : Meteor.settings.public.stripe.liveClientId; 

Router.route('/stripe', function(){
    Router.go('/stripe/start');
});
Router.route('/stripe/:state', function(){
    var state = this.params.state;
    console.log("stripe state", state);
    var authUrl = stripeUrl + "/oauth/authorize?response_type=code&scope=read_write&client_id=" + stripeClientId;
    var data = {};
    if(state == "partner") {
        var token = _.keys(this.params.query)[0];
        Meteor.loginWithToken(token, function(error, result){
            if(error){
                lastError.set(error.error);
                return;
            }
        });
    }
    if(state == "back") {
        Meteor.call("auth_token", this.params.query.code, function(err, result) {
            console.log("result", err, result);
            Router.go("/stripe/done");
        });
    }
    this.render("stripe_" + state, {
        data : { stripeUrl : authUrl }
    });
});


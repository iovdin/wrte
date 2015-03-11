stripeClientId = stripeTest ? Meteor.settings.public.stripe.testClientId : Meteor.settings.public.stripe.liveClientId; 

Router.route('/stripe', function(){
    this.redirect('/stripe/start');
});
Router.route('/stripe/:state', function(){
    //this.params.state
    var state = this.params.state;
    console.log("stripe state", state);
    var authUrl = stripeUrl + "/oauth/authorize?response_type=code&client_id=" + stripeClientId;
    var data = {};
    if(this.params.state == "back") {
        Meteor.call("auth_token", this.params.query.code, function(err, result){
            console.log("result", err, result);
            Router.go("/stripe/done");
        });
    }
    /*switch(this.params.state){

      }*/
    this.render("stripe_" + state, {
        data : {
            stripeUrl : authUrl,
        }
    });
});


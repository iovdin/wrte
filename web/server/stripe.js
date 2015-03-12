stripePrivKey = stripeTest ? Meteor.settings.stripe.testPrivateKey : Meteor.settings.stripe.livePrivateKey ;

Meteor.methods({
    auth_token : function(code, email, name) {
        if(!Meteor.userId()){
            throw new Meteor.Error("not_authorized");
        }
        var stripe = StripeAPI(stripePrivKey);
        var accountRetrieveSync = Meteor.wrapAsync(stripe.account.retrieve, stripe.account);
        
        //TODO: error processing
        var result = HTTP.post(stripeUrl +"/oauth/token", { params : { grant_type : "authorization_code", code : code, client_secret : stripePrivKey} });
        var svc = _.pick(result.data, 'access_token', 'refresh_token', 'stripe_publishable_key', 'stripe_user_id');

        var account = accountRetrieveSync(svc.access_token);
        svc.default_currency = account.default_currency;

        //console.log("result", result.data);
        Meteor.users.update({_id : Meteor.userId()}, {$set : {"services.stripe" : svc}});
        return svc;
    }
});

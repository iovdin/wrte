Meteor.loginWithEmailToken = function(token, callback){
    Accounts.callLoginMethod({ 
        methodArguments: [{ emailToken : token }],
    userCallback: function (error, result) {
        if(!callback) return;
        if (error) 
            callback(error);
        else 
            callback();

    }})
}
Meteor.loginWithTempToken = function(token, callback){
    Accounts.callLoginMethod({ 
        methodArguments: [{ tempToken : token }],
    userCallback: function (error, result) {
        if(!callback) return;
        if (error) 
            callback(error);
        else 
            callback();

    }})
}

Template.login.rendered = function(){
    $(".maincontent").addClass("blur");
};
Template.login.destroyed = function(){
    $(".maincontent").removeClass("blur");
};
Template.login_email_sent.rendered = function(){
    $(".maincontent").addClass("blur");
};
Template.login_email_sent.destroyed = function(){
    $(".maincontent").removeClass("blur");
};
Template.login_link_opened.rendered = function(){
    $(".maincontent").addClass("blur");
};
Template.login_link_opened.destroyed = function(){
    $(".maincontent").removeClass("blur");
};


Template.login.events({
    'click button' : function(e, template) {
        e.preventDefault();
        var email = $('#login_name').val();
        var path = Router.current().location.get().path;
        console.log("login with email", email);
        Meteor.call('send_login', email, path.substr(1), function(error, result){
            if(error){
                //TODO:
                lastError.set(error.error)
                console.log("error sending link", error);
                return;
            }
            goToHash("login_email_sent");
        });
    }
});

Template.login_failed.events({
    'click #retry' : function(e){
        e.preventDefault();
        goToHash("login");
    }
})

Tracker.autorun(function(){
    if(popup.get() == "login_link_opened") {
        var router = Router.current();
        if(!router) return;
        var token = _.keys(Router.current().params.query)[0];
        Meteor.loginWithEmailToken(token, function(error, result){
            console.log("logged in with token ", error, result);
            if(error){
                //TODO: error
                console.log("error logging in", error);
                lastError.set(error.error);
                goToHash("login_failed");
                return;
            }
            Meteor.call('user_state', function(error, result){
                if(error){
                    lastError.set(error.error);
                    return;
                }
                registredEmail.set(Meteor.user().username + "@wrte.io");
                if(!result.stripe) {
                    Router.go("/signup/sendmoney");
                    return;
                }

                if(!result.active){
                    Router.go('/signup/done-not-authorized');
                }

                //opening login link automatically activates account
                if(!result.verified) {
                    Router.go('/signup/done-not-verified');
                    return;
                }
                if(result.justverified) {
                    Router.go('/signup/done');
                    return;
                }
                Router.go('/dashboard/settings');
            });
        });
    }
});

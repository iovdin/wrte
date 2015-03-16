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

Template.login.events({
    'click button' : function(e, template) {
        e.preventDefault();
        var email = $('#login_name').val();
        var path = Router.current().location.get().path;
        console.log("login with email", email);
        Meteor.call('send_email_token', email, path.substr(1), function(error, result){
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

Tracker.autorun(function(){
    if(popup.get() == "login_link_opened") {
        var token = _.keys(Router.current().params.query)[0];
        Meteor.loginWithEmailToken(token, function(error, result){
            console.log("logged in with token ", error, result);
            if(error){
                //TODO: error
                console.log("error logging in", error);
                return;
            }
        });
    }
});

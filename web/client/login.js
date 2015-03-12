Meteor.loginWithToken = function(token, callback){
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
        var username = $('#username').text();
        var path = Router.current().location.get().path;
        Meteor.call('send_email_token', username, path.substr(1), function(error, result){
            if(error){
                //TODO: error
                console.log("error sending link", error);
                return;
            }
            goToHash("login_email_sent");
        });
    }
});

Router.onAfterAction(function(){
    if (this.params.hash == "login_link_opened"){
        var token = _.keys(this.params.query)[0];
        Meteor.loginWithToken(token, function(error, result){
            console.log("logged in with token ", error, result);
            if(error){
                //TODO: error
                return;
            }
            Router.go('/dashboard');
        });
    }
    //this.next();
});

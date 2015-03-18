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
                return;
            }
            goToHash("");
        });
    }
});

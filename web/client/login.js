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

Template.login_input.events({
    'click button' : function(e) {
        e.preventDefault();
        var username = $('#username').text();
        Meteor.call('send_email_token', username, function(error, result){
            if(error){
                //TODO: error
                console.log("error sending link", error);
                return;
            }
            Router.go("/login/email_sent");
        });
    }
});

Router.route('/login', function(){
    if(!Meteor.userId()) {
        this.layout("LoginLayout");
        this.render("login_input");
    } else {
        Router.go('/');
    }
});

Router.route('/login/:state', function(){
    var state = this.params.state;
    this.layout("LoginLayout");
    console.log("login: " + state);
    if(state == 'link_opened') {
        var token = _.keys(this.params.query)[0];
        Meteor.loginWithToken(token, function(error, result){
            console.log("logged in with token ", error, result);
            if(error){
                //TODO: error
                return;
            }
            Router.go('/');
        });
        console.log("query", this.params.query);
    }
    this.render("login_" + state);
});

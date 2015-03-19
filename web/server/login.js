Accounts.registerLoginHandler(function(loginRequest) {
    if( !loginRequest.emailToken ) {
        return;
    }
    var user = Meteor.users.findOne({'services.email.token': loginRequest.emailToken});

    if(!user) {
        return;
    }

    //reset token
    //Meteor.users.update({_id : user._id}, {$set : {'services.email' : {}}});

    if(!user.emails[0].verified){
        Meteor.users.update(user._id, {$set : { "emails.0.verified" : "justverified"}});
    }

    var stampedToken = Accounts._generateStampedLoginToken();
    var hashStampedToken = Accounts._hashStampedToken(stampedToken);

    Meteor.users.update(user._id, {$push: {'services.resume.loginTokens': hashStampedToken}});


    return {
        userId: user._id,
        token: stampedToken.token
    };
});
Accounts.registerLoginHandler(function(loginRequest) {
    if( !loginRequest.tempToken ) {
        return;
    }
    var user = Meteor.users.findOne({'services.temp.token': loginRequest.tempToken});

    if(!user) {
        return ;
    }

    //reset token
    //Meteor.users.update({_id : user._id}, {$set : {'services.email' : {}}});

    var stampedToken = Accounts._generateStampedLoginToken();
    var hashStampedToken = Accounts._hashStampedToken(stampedToken);

    Meteor.users.update(user._id, {$push: {'services.resume.loginTokens': hashStampedToken}, $set : { "services.temp" : {}}});


    return {
        userId: user._id,
        token: stampedToken.token
    };
});

Meteor.methods({
    'send_login' : function(input, path) {
        console.log("send_email_token to " + input);

        var arr = input.split("@");
        var search = {};
        if(arr.length == 1){
            search.username = input;
        }else if(arr.length == 2){
            if(arr[1] == "wrte.io"){
                search.username = arr[0];
            } else {
                search = {"emails.0.address" : input}
            }
        } else {
            throw new Meteor.Error("not_found");
        }
        var user = Meteor.users.findOne(search);
        if(!user) {
            throw new Meteor.Error("not_found");
        }
        sendVerification(user, path, "login to wrte.io", "login_email");
        return true;
    },
    'send_verification' : function(path) {
        if(!Meteor.userId()){
            throw new Meteor.Error("not_authorized");
        }
        if(_.get(Meteor.user(), "emails.0.verified")){
            //return;
        }

        if(Meteor.user().active){
            sendVerification(Meteor.user(), path, "Welcome to wrte.io", "verify_email");
        } else {
            sendVerification(Meteor.user(), path, "Welcome to wrte.io", "welcome_beta");
        }
    },
    'user_state' : function(){
        if(!Meteor.user())
            return ;

        var user = Meteor.user();
        console.log("user", user);
        var verified = user.emails[0].verified
        if(verified == "justverified") {
            Meteor.users.update(user._id, {$set : { "emails.0.verified" : true}});
        } 

        return { active : user.active, verified : verified, justverified : (verified == "justverified"), stripe : _.get(user, "services.stripe")};
    }
});

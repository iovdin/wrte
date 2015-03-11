Accounts.registerLoginHandler(function(loginRequest) {
    if( !loginRequest.emailToken ) {
        return null;
    }
    var user = Meteor.users.findOne({'services.email.token': loginRequest.emailToken});

    if(!user) {
        return null;
    }

    //reset token
    //Meteor.users.update({_id : user._id}, {$set : {'services.email' : {}}});

    var stampedToken = Accounts._generateStampedLoginToken();
    var hashStampedToken = Accounts._hashStampedToken(stampedToken);

    Meteor.users.update(user._id, {$push: {'services.resume.loginTokens': hashStampedToken}});


    return {
        userId: user._id,
        token: stampedToken.token
    };
});

Meteor.methods({
    'send_email_token' : function(username) {
        console.log("send_email_token to " + username);
        var user = Meteor.users.findOne({username : username});
        if(!user) {
            throw new Meteor.Error("not_found");
        }
        var emailToken = Random.secret();
        var email = user.emails[0].address;
        Meteor.users.upsert(user._id, {$set : {'services.email' : { token : emailToken, when : new Date() } }});

        var loginTemplate = _.template(Assets.getText("email_templates/login_email.txt"));

        Email.send({
            to : email,
            from : "wrte <support@wrte.io>",
            subject : "login to wrte.io",
            text : loginTemplate({email : username + "@wrte.io", link : Meteor.absoluteUrl('login/link_opened?' + emailToken)}),
        });
        return true;
    }
});

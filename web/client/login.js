Meteor.loginWithToken = function(token, callback){
    Accounts.callLoginMethod({
        methodArguments: [{ emailToken : token }],
    userCallback: function (error, result) {
        if(!callback) return;
        if (error) {
            callback(error);
        } else {
            callback();
        }
    });
}

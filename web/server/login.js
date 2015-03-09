Accounts.registerLoginHandler(function(loginRequest) {
  var user = Meteor.users.findOne({phone: loginRequest.phone});

  if(user.code !== loginRequest.code) {
    return null;
  }

  var stampedToken = Accounts._generateStampedLoginToken();
  var hashStampedToken = Accounts._hashStampedToken(stampedToken);

  Meteor.users.update(userId,
    {$push: {'services.resume.loginTokens': hashStampedToken}}
  );

  return {
    id: user._id,
    token: stampedToken.token
  };
});

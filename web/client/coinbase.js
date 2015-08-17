
coinbaseAuthUrl = function(back){
    return "https://www.coinbase.com/oauth/authorize?response_type=code&client_id=" + Meteor.settings.public.coinbase.clientId + "&redirect_uri=" + encodeURIComponent(Meteor.absoluteUrl(back, {secure : true})) + "&scope=wallet:accounts:read,wallet:addresses:create";

}

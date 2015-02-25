Router.route("/allusers", function(){
    var emails = Meteor.users.find({}, { fields : {username : 1, "emails.address" : 1 }}).map(function(user){
        return [user.username, user.emails[0].address]
    });
    var text = _.chain(emails).map(function(email, index){
        return (index+1) + ". " + email[0] + "@wrte.io -> " + email[1];
    }).value().join("\n");
    var allusersTemplate = _.template(Assets.getText("email_templates/allusers.txt"));
    var content = allusersTemplate({emails : text})

    Email.send({
        to : "support@wrte.io",
        from : "Wrte <support@wrte.io>",
        subject : "all registered users",
        text : content,
    });
    this.response.writeHead(200);
    this.response.end("done");
}, { where : "server"});

Router.route("/convert", function(){

    var result = HTTP.get("https://bitpay.com/api/rates/USD");
    var btc2usd = result.data.rate;
    var emails = Meteor.users.find({}, { fields : {username : 1, price : 1, currency : 1, amount : 1 }}).map(function(user){
        var usd = (btc2usd * user.price);
        usd = parseFloat(usd.toFixed(2));
        usd = Math.max(usd, 0.60);
        //console.log("old price ",  user.price, "new price", usd);
        Meteor.users.update(user._id, {$set : {amount : usd, currency : "usd"}});
        return null 
    });
    this.response.writeHead(200);
    this.response.end("done");
}, { where : "server"});
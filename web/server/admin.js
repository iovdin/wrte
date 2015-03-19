Router.route("/allusers", function(){
    var emails = Meteor.users.find({}, { fields : {username : 1, "emails.address" : 1 }, sort : {createdAt : 1} }).map(function(user){
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

checkIfAdmin = function(){
    if(!Meteor.userId() || ["ilya", "ivan"].indexOf(Meteor.user().username) < 0) {
        throw new Meteor.Error("not_authorized");
    }
}

Meteor.startup(function () {
    Meteor.publish("users", function(){
        if(!this.userId) return [];
        var user = Meteor.users.findOne({_id : this.userId});
        if(["ilya", "ivan"].indexOf(user.username) < 0) {
            return [];
        }
        return Meteor.users.find({}, {sort : {createdAt : -1}, fields : { username : 1, active : 1, amount : 1, "emails" : 1, "services.stripe" : 1, "services.email.numSent" : 1, createdAt : 1}});
    });

    Meteor.publish("admin_invoices", function(){
        if(!this.userId) return [];
        var user = Meteor.users.findOne({_id : this.userId});
        if(["ilya", "ivan"].indexOf(user.username) < 0) {
            return [];
        }
        return invoices.find({}, {sort : {createdAt : -1},  limit : 50});
    });
});

Meteor.methods({
    'partner_invite' : function(email){
        checkAdmin();
        var user = Meteor.users.findOne({"emails.0.address" : email});
        if(!user) {
            var userId = Accounts.createUser({email : email});
            user = Meteor.users.findOne({_id : userId});
        }
        var emailToken = Random.secret();
        Meteor.users.update(user._id, {$set : {'services.email' : { token : emailToken, when : new Date() } }});
        return emailToken;
    },
    'admin_activate' : function(userId){
        checkIfAdmin();
        Meteor.users.update({_id : userId}, {$set : {active : true}});
    },
    'admin_deactivate' : function(userId){
        checkIfAdmin();
        Meteor.users.update({_id : userId}, {$set : {active : false}});
    },
    'admin_verify' : function(userId){
        checkIfAdmin();
        var user = Meteor.users.findOne({_id : userId});
        if( !user ) {
            throw new Meteor.Error("not_found");
        }
        sendVerification(user, "signup/sendmoney", 'wrte.io beta is alive', 'welcome_invite');
    }
});

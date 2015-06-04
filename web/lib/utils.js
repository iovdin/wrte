_.mixin({
    get : function(obj, path) {
        if(!_.isString(path)) {
            return undefined;
        }
        var apath = path.split("."); 
        return _.reduce(apath, function(memo, item){
            //console.log("reduce", memo, item);
            if( _.isObject(memo) && _.has(memo, item) ) {
                return memo[item];
            }
            if(_.isString(memo))
                return memo;
            return  undefined;
        }, obj);
    }
});


minAmount = 0.99;
maxAmount = 1000;

isAmountValid = function(price){
    if(!_.isNumber(price) || _.isNaN(price))
        return "amount_nan";

    //min 1 USD
    if ( price < minAmount) 
        return "amount_toosmall";
    if ( price > maxAmount) 
        return "amount_toobig";

    return "amount_valid";
}

totalFee = function(amount, isBitcoin){
    return wrteFee(amount) + stripeFee(amount, isBitcoin);
}
wrteFee = function(amount) {
    return Math.round(amount * 0.05);
}
//TODO: handle no cents currencies
stripeFee = function(amount, bitcoins) {
    if(bitcoins) return Math.round(0.005 * amount);
    return Math.round(amount * 0.029) + 30;
}

if(Meteor.isClient){
    Template.registerHelper("minAmount", function(){
        return minAmount;
    });
    Template.registerHelper("maxAmount", function(){
        return maxAmount;
    });
    cardFee = function(getAmount) {
        return function(){
            var amount = getAmount() * 100;
            var fee = totalFee(amount, false);
            return (fee * 0.01).toFixed(2);
        }
    }
    bitcoinFee = function(getAmount) {
        return function(){
            var amount = getAmount() * 100;
            var fee = totalFee(amount, true);
            return (fee * 0.01).toFixed(2);
        }
    }
    amountChange = function(callback){
        return function(event){
            var amountText = event.currentTarget.textContent;
            var lamount;
            if(!amountText) {
                lamount = minAmount;
            } else {
                lamount = parseFloat(amountText);
            }
            callback(lamount);
            //validateAmount(lamount);
            //amount.set(lamount);
        }
    }

    goToHash = function(newHash){
        var router = Router.current();
        var path = router.location.get().path;
        Router.go(path + "#" + newHash);
        $(".backing").addClass("blur");
    }
    Template.registerHelper("case", function(){
        var pair =_.chain(this).pairs().first().value();

        var key = pair[0];
        var value = pair[1];

        var pdata = Template.parentData(1);
        _.extend(this, pdata);

        if(pdata && pdata[key] && pdata[key] == value) {
            return Template._case_default;
        }
        var rvar = window[key];
        if(!rvar){
            rvar = window[key] = new ReactiveVar("default");
        }
        if(rvar instanceof ReactiveVar && rvar.get() == value) {
            return Template._case_default;
        }
        return null;
    });

    inputValidator = function(serverMethodName, statusVar){
        var checkSeq = 0;
        var handler = _.debounce(function(value){
            var myCheckSeq = ++checkSeq;
            Meteor.call(serverMethodName, value, function(error, result){
                //this call of serverMethodName is expired, new one has been made
                if(myCheckSeq != checkSeq) return;
                statusVar.set(result);
                checkSeq = 0;
            });
        }, 500);
        return function(value){
            statusVar.set("checking");
            handler(value);
        }
    }
    // parseUri 1.2.2
    // (c) Steven Levithan <stevenlevithan.com>
    // MIT License

    parseUri = function(str) {
        var	o   = parseUri.options,
            m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
            uri = {},
            i   = 14;

        while (i--) uri[o.key[i]] = m[i] || "";

        uri[o.q.name] = {};
        uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
            if ($1) uri[o.q.name][$1] = decodeURIComponent($2);
        });

        return uri;
    };

    parseUri.options = {
        strictMode: false,
        key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
        q:   {
            name:   "queryKey",
            parser: /(?:^|&)([^&=]*)=?([^&]*)/g
        },
        parser: {
            strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
            loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
        }
    };
}
if (Meteor.isServer){
    sendVerification = function(user, path, subject, templateName){
        if(!user) {
            throw new Meteor.Error("not_found");
        }
        var template = _.template(Assets.getText("email_templates/" + templateName + ".txt"));
            
        var email = _.get(user, "emails.0.address");
        var emailToken = Random.secret();
        var numSent = _.get(user, "services.email.numSent") || 0;

        Meteor.users.update({_id : user._id}, {$push : {'services.email.tokens' : { token : emailToken, when : new Date()}}, $set : { 'services.email.numSent' : numSent + 1} });

        Email.send({
            to : email,
            from : "wrte <support@wrte.io>",
            subject : subject,
            text : template({email : user.username + "@wrte.io", link : Meteor.absoluteUrl(path + '?' + emailToken + "#login_link_opened", {secure : true})}),
        });

    }
}

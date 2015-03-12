stripePrivKey = stripeTest ? Meteor.settings.stripe.testPrivateKey : Meteor.settings.stripe.livePrivateKey ;
Meteor.startup(function () {
    Meteor.publish("invoice", function(id){
        var invoice =  invoices.findOne({ _id : id });
        if(invoice){
            var invoiceId = invoice._id;
            var delta = (new Date() - invoice.createdAt) * 0.001;
            //console.log("delta " + delta);
            var from = invoice.from;
            if(invoice.status == 'created') {
                invoice.status = "opened";
                if(delta > Meteor.settings.public.openInvoiceTimeout) {
                    invoice.status = "timeout_open";
                } 
                invoices.update({ _id : invoiceId }, {$set : {status : invoice.status}});
            }
        }
        return invoices.find({_id : id});
    });
});


Meteor.methods({
    invoice_charge : function(invoiceId, source) {
        var invoice = invoices.findOne({_id : invoiceId });
        if(invoice.status != 'opened'){
            return invoice;
        }

        //find stripe access token
        var user = Meteor.users.findOne(invoice.userId);
        var ref = user.services.stripe.ref;
        if(ref)
            user = Meteor.users.findOne(ref);

        //TODO: refresh if nessesary
        var stripeAccessToken = user.services.stripe.access_token;
        
        
        var stripe = StripeAPI(stripePrivKey);
        var createSync = Meteor.wrapAsync(stripe.charges.create, stripe.charges);
        //console.log("invoice", invoice);
        var charge = createSync({
            amount: invoice.amount * 100,
            currency: invoice.currency,
            source: source, 
            metadata : { invoice : invoiceId, user : invoice.userId },
            description: "email to : " + invoice.to, 
        }, stripeAccessToken);

        console.log("charge", charge);
        if(charge.status == 'succeeded'){
            invoice.status = 'paid';
        } else {
            invoice.status = 'mispaid';
        }
        invoices.update({_id : invoiceId}, {$set : {status : invoice.status}});
        return invoice;
    }, 
    auth_token : function(code, email, name) {
        if(!Meteor.userId()){
            throw new Meteor.Error("not_authorized");
        }
        var result = HTTP.post(stripeUrl +"/oauth/token", { params : { grant_type : "authorization_code", code : code, client_secret : stripePrivKey} });
        var svc = _.pick(result.data, 'access_token', 'refresh_token', 'stripe_publishable_key', 'stripe_user_id');
        //console.log("result", result.data);
        Meteor.users.update({_id : Meteor.userId()}, {$set : {"services.stripe" : svc}});
        return svc;
    }
});

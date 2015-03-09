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
        var stripe = StripeAPI(stripePrivKey);
        var createSync = Meteor.wrapAsync(stripe.charges.create, stripe.charges);
        //console.log("invoice", invoice);
        var charge = createSync({
            amount: invoice.amount * 100,
            currency: invoice.currency,
            source: source, 
            metadata : { invoice : invoiceId, user : invoice.userId },
            description: "email to : " + invoice.to, 
        });
        if(charge.status == 'succeeded'){
            invoice.status = 'paid';
        } else {
            invoice.status = 'mispaid';
        }
        invoices.update({_id : invoiceId}, {$set : {status : invoice.status}});
        return invoice;
    }, 
    auth_token : function(code){
        var result = HTTP.post(stripeUrl +"/oauth/token", { params : { grant_type : "authorization_code", code : code, client_secret : stripePrivKey} });
        var svc = _.pick(result, 'access_token', 'refresh_token', 'stripe_publishable_key', 'stripe_user_id');
        Meteor.user
        if(result.data)

        return result;
    }
});
        

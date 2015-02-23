stripePrivKey = stripeTest ? Meteor.settings.stripe.testPrivateKey : Meteor.settings.stripe.livePrivateKey ;

console.log("stripePrivKey", stripePrivKey);
Meteor.methods({
    invoice_status : function(invoiceId){
        var invoice = invoices.findOne({_id : invoiceId });
        if(!invoice){
            throw new Meteor.Error("not_found", "No such invoice");
        }
        var from = invoice.from;
        if(invoice.status == 'created') {
            invoices.update({ _id : invoiceId }, {$set : {status : "opened"}});
        }
        //console.log("invoice", this.userId, invoice);
        return invoice;
    },
    invoice_charge : function(invoiceId, source){
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
        //console.log("charge", charge);
        return invoice;
    }
});
        

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
        //TODO: refresh token if nessesary
        var stripeAccessToken = user.services.stripe.access_token;
        
        var stripe = StripeAPI(stripePrivKey);
        var createSync = Meteor.wrapAsync(stripe.charges.create, stripe.charges);

        var amount = invoice.amount * 100;
        var charge;
        var chargeData = {
            amount: amount,
            currency: invoice.currency,
            source: source, 
            metadata : { invoice : invoiceId, user : invoice.userId },
            description: "email to : " + invoice.to, 
        }
        if(stripeAccessToken) {
                chargeData["application_fee"] = wrteFee(amount);
        } else{
            //watsi
            chargeData.metadata.watsi = true;
        }

        try{
            charge = createSync(chargeData, stripeAccessToken);
        } catch(e) {
            console.log("charge error");
            console.log(e.stack)
            invoices.update({_id : invoiceId}, {$set : {status : "error", errmsg : e.message}});
            throw new Meteor.Error("charge_error");
        }
        console.log("charge", charge);
        if(charge.status == 'succeeded'){
            invoice.status = 'paid';
        } else {
            invoice.status = 'mispaid';
        }
        invoices.update({_id : invoiceId}, {$set : {status : invoice.status}});
        return invoice;
    }
});

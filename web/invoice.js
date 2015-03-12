if(Meteor.isClient){
//stripePubKey = stripeTest ? Meteor.settings.public.stripe.testPublicKey : Meteor.settings.public.stripe.livePublicKey; 
    buttonId = new ReactiveVar("");
    stripeHandler = null;
    Meteor.startup(function () {
        //Stripe.setPublishableKey(Meteor.settings.public.stripe.publicKey);
        //console.log("settings", Meteor.settings);
        // code to run on server at startup
    });

    var invoice = null;

    var stripeHandler = null;
    var invoiceRoute = function () {
        var status = this.params.status;
        var invoiceId = this.params._id;
        var invoice = null;

        if(invoiceId == 'test'){
            invoice = { subject : "Hello World", status : "opened", to : "to@test.com", from : "from@test.com", "amount" : 1, currency : "usd" };
        }else {
            this.wait(Meteor.subscribe('invoice', invoiceId));
            if (!this.ready()) {
                this.render('invoice_loading');
                return;
            }
            invoice = invoices.findOne({});
        }
        var data = {
            openTimeout : moment.duration(Meteor.settings.public.openInvoiceTimeout, "seconds").humanize(),
            payTimeout  : moment.duration(Meteor.settings.public.payInvoiceTimeout, "seconds").humanize()
        };
        _.extend(data, invoice);
        if(!status){
            status = invoice.status;
        } 
        this.render('invoice_' + status, { data : data });

        if(status == "opened"){
            stripeHandler = StripeCheckout.configure({
                key: invoice.stripePublishableKey,
                token: function(token) {
                    Meteor.call('invoice_charge', invoiceId, token.id, function(err, result){
                        console.log("invoice_charge", err, result);
                    });
                }
            });

            stripeHandler.open({
                name: 'to ' + invoice.to,
                description: invoice.subject,
                currency: invoice.currency,
                amount: invoice.amount * 100, 
                bitcoin : true,
                email : invoice.from,
            });
        } else if(stripeHandler){
            stripeHandler.close();
        }
    }

    Router.route('/invoice/:_id', invoiceRoute);
    Router.route('/invoice/:_id/:status', invoiceRoute);
}

if (Meteor.isServer){

}

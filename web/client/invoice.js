stripePubKey = stripeTest ? Meteor.settings.public.stripe.testPublicKey : Meteor.settings.public.stripe.livePublicKey; 
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
    if(data.btc){
        data.btc.uri = "bitcoin:" + data.btc.address + "?amount=" + data.btc.amount;
    }
    this.render('invoice_' + status, { data : data });

    if(status == "opened"){
        if(!invoice.btc) {
            stripeHandler = StripeCheckout.configure({
                key: invoice.stripePublishableKey || stripePubKey,
                token: function(token) {
                    Meteor.call('invoice_charge', invoiceId, token.id, function(err, result){
                        if(err){
                            lastError.set(err.error);
                        }
                        console.log("invoice_charge", err, result);
                    });
                }
            });

            //TODO: bitcoins
            stripeHandler.open({
                name: 'to ' + invoice.to,
                description: invoice.subject,
                currency: invoice.currency,
                amount: invoice.amount * 100, 
                bitcoin : true,
                email : invoice.from,
            });
        }
    } else if(stripeHandler){
        stripeHandler.close();
    }
}

Router.route('/invoice/:_id', invoiceRoute);
Router.route('/invoice/:_id/:status', invoiceRoute);

Template.invoice_opened.rendered = function(){
    if(!this.data.btc) {
        return;
    }
    this.$("#qrcode").qrcode({
        text: this.data.btc.uri,
        width: 256,
        height: 256,
    });
}

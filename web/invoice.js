if(Meteor.isClient){
stripePubKey = stripeTest ? Meteor.settings.public.stripe.testPublicKey : Meteor.settings.public.stripe.livePublicKey; 
console.log("stripePubKey", stripePubKey);
    buttonId = new ReactiveVar("");
    stripeHandler = null;
    Meteor.startup(function () {
        //Stripe.setPublishableKey(Meteor.settings.public.stripe.publicKey);
        //console.log("settings", Meteor.settings);
        // code to run on server at startup
    });


    Router.route('/invoice/:_id', function () {
        invoiceStatus.set("create");
        this.render('invoice');
        var invoiceId = this.params._id;

        Meteor.call('invoice_status', invoiceId, function(err, result){
            if(err){
                invoiceStatus.set("error");
                lastError.set(err.reason);
                return;
            }
            var stripeHandler = StripeCheckout.configure({
                key: stripePubKey,
              token: function(token) {
                  //console.log("handler", token);
                  Meteor.call('invoice_charge', invoiceId, token.id, function(err, result){
                      switch(result.status) {
                          case 'paid':
                              invoiceStatus.set("paid");
                              break;
                           case 'mispaid':
                              invoiceStatus.set("error");
                              lastError.set("Payment error");

                      }
                  });
              }
            });
            switch(result.status){
                case "created":
                case "opened":
                    stripeHandler.open({
                        name: 'To: ' + result.to,
                        description: result.subject,
                        currency: result.currency,
                        amount: result.amount * 100, 
                        bitcoin : true,
                        email : result.from,
                        opened : function(){

                        }, 
                        closed : function(){

                        }
                    });
                    //buttonId.set(data.button);
                    invoiceStatus.set("created");
                    break;
                //TODO:
                case "timeout1":
                case "timeout2":
                    invoiceStatus.set("timeout");
                    break;
                case "paid":
                    invoiceStatus.set("paid");
                    break;
            }
        });
    });
}

var devenv = (Meteor.absoluteUrl().indexOf("http://localhost") == 0);
btcTest = devenv; 
stripeTest = devenv;
stripeUrl = "https://connect.stripe.com";

watsiAddress = devenv ?  "mnM6aRDB38BzngW99M14u3JafvWj7ZSvvo" : Meteor.settings.public.watsiAddress;

invoices = new Mongo.Collection("Invoice");

if(Meteor.isClient){
    popup = new ReactiveVar("");
}

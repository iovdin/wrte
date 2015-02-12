if(Meteor.isClient){
    buttonId = new ReactiveVar("");

    Router.route('/invoice/:_id', function () {
        //var item = Items.findOne({_id: this.params._id});
        invoiceStatus.set("create");
        this.render('invoice');

        HTTP.get("/btc/create", {params : {id : this.params._id} }, function(err, result){
            if(err){
                console.log(err);
                invoiceStatus.set("error");
                return;
            }
            console.log(result);
            var data = JSON.parse(result.content);
            switch(data.status){
                case "created":
                    buttonId.set(data.button);
                    invoiceStatus.set("created");
                    break;
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

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

if(Meteor.isClient){
    inputValidator = function(serverMethodName, statusVar){
        var checkSeq = 0;
        var handler = _.debounce(function(value){
            var myCheckSeq = ++checkSeq;
            Meteor.call(serverMethodName, value, function(error, result){
                //this call of serverMethodName is expired, new one has been made
                if(myCheckSeq != checkSeq) return;
                statusVar.set(result ? "valid" : "invalid");
                checkSeq = 0;
            });
        }, 500);
        return function(value){
            statusVar.set("checking");
            handler(value);
        }
    }
}

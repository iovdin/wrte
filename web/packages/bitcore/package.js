Npm.depends({
    "bitcore": "0.11.7",
});

Package.on_use(function (api, where) {

  if(api.export){
      api.export('bitcore', 'server')
  } 

  api.add_files(['bitcore.js'], 'server');
});

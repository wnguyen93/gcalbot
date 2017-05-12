var mongoose = require('mongoose');


var Oauth2ClientSchema = mongoose.Schema( {
    
  oauth2_client: {
      transporter: {
        type: String
      },
      clientID_ : String,
      clientSecret_ : String,
      redirectUri_ : String,
      opts: {type: String},
      credentials: {
        access_token: String,
        id_token: String,
        refresh_token: String,
        expiry_date: Number
      }

    }

  });

Oauth2ClientSchema.methods.toJSON = function () {
  var oauthinfo = this;
  var oauthinfoObject = oauthinfo.toObject();
  return oauthinfoObject;

};


var Oauth2Client = mongoose.model('Oauth2Client', Oauth2ClientSchema);

module.exports = {Oauth2Client};
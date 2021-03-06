
var express = require('express');
var router = express.Router();
var request = require('request');

//Helper function imports
var authHelper = require('../helperfunctions/authHelper.js');
var requestUtil = require('../helperfunctions/requestUtil.js');
var emailer = require('../helperfunctions/emailer.js');

/* GET home page. */
router.get('/', function (req, res) {
  // check for token
  console.log("#### I am here #1 #####");
  if (req.cookies.REFRESH_TOKEN_CACHE_KEY === undefined) {
    res.redirect('/o365/login');
  } else {
    renderSendMail(req, res);
  }
});

router.get('/disconnect', function (req, res) {
  // check for token
  req.session.destroy();
  res.clearCookie('nodecookie');
  clearCookies(res);
  res.status(200);
  res.redirect('https://pointylabs.herokuapp.com/o365/login');
});

/*Authentication page. */
router.get('/login', function (req, res) {
  console.log("#### I am here #2 #####"); 
  if (req.query.code !== undefined) {
    console.log("#### I am here #2.1 #####"); 
    //console.log(req.query.code);
    authHelper.getTokenFromCode(req.query.code, function (e, accessToken, refreshToken) {
      if (e === null) {
        
        // cache the refresh token in a cookie and go back to index
        res.cookie(authHelper.ACCESS_TOKEN_CACHE_KEY, accessToken);
        res.cookie(authHelper.REFRESH_TOKEN_CACHE_KEY, refreshToken);
        res.redirect('/o365/');
      } else {
        console.log(JSON.parse(e.data).error_description);
        res.status(500);
        res.send();
      }
    });
  } else {
    console.log("#### I am here #3 #####"); 
    res.render('pages/o365login', { auth_url: authHelper.getAuthUrl() });
  }
});

router.post('/', function (req, res) {
  var destinationEmailAddress = req.body.default_email;
  var mailBody = emailer.generateMailBody(
    req.session.user.displayName,
    destinationEmailAddress
  );
  var templateData = {
    display_name: req.session.user.displayName,
   user_principal_name: req.session.user.userPrincipalName,
    actual_recipient: destinationEmailAddress
  };

  requestUtil.postSendMail(
    req.cookies.ACCESS_TOKEN_CACHE_KEY,
    JSON.stringify(mailBody),
    function (firstRequestError) {
      if (!firstRequestError) {
        res.render('pages/sendMail', templateData);
      } else if (hasAccessTokenExpired(firstRequestError)) {
        // Handle the refresh flow
        authHelper.getTokenFromRefreshToken(
          req.cookies.REFRESH_TOKEN_CACHE_KEY,
          function (refreshError, accessToken) {
            res.cookie(authHelper.ACCESS_TOKEN_CACHE_KEY, accessToken);
            if (accessToken !== null) {
              requestUtil.postSendMail(
                req.cookies.ACCESS_TOKEN_CACHE_KEY,
                JSON.stringify(mailBody),
                function (secondRequestError) {
                  if (!secondRequestError) {
                    res.render('pages/sendMail', templateData);
                  } else {
                    clearCookies(res);
                    renderError(res, secondRequestError);
                  }
                }
              );
            } else {
              renderError(res, refreshError);
            }
          });
      } else {
        renderError(res, firstRequestError);
      }
    }
  );
});


router.get('/calendar/view', (req,rsp) => {
console.log('REQ.COOKIES.ACCESS_TOKEN', req.cookies.ACCESS_TOKEN_CACHE_KEY);
  var headers = {
 //   'Content-Type': 'application/json',
     Accept: 'application/json',
     Authorization: 'Bearer ' + req.cookies.ACCESS_TOKEN_CACHE_KEY
//    'Content-Length': 0
  };
  var options = {
    uri: 'https://graph.microsoft.com/v1.0/me/calendars/',  
    host: 'graph.microsoft.com',
    path: '/v1.0/me/calendars',
    method: 'GET',
    headers: headers
  };

require('request').debug = true;

request(options, function (error, response, body) {
  
  console.log("Hello calendar ***********************");
  console.log('error:', error); // Print the error if one occurred
  console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
  console.log('body:', body); // Print the HTML for the Google homepage.
});

});



/*** HElPER Functions ********/

function hasAccessTokenExpired(e) {
  var expired;
  if (!e.innerError) {
    expired = false;
  } else {
    expired = e.code === 401 &&
      e.innerError.code === 'InvalidAuthenticationToken' &&
      e.innerError.message === 'Access token has expired.';
  }
  return expired;
}

function clearCookies(res) {
  res.clearCookie(authHelper.ACCESS_TOKEN_CACHE_KEY);
  res.clearCookie(authHelper.REFRESH_TOKEN_CACHE_KEY);
}

function renderError(res, e) {
  res.render('error', {
    message: e.message,
    error: e
  });
}

function renderSendMail(req, res) {
    console.log("#### I am here #4 #####"); 
    requestUtil.getUserData(
    req.cookies.ACCESS_TOKEN_CACHE_KEY,
    function (firstRequestError, firstTryUser) {
      if (firstTryUser !== null) {
        req.session.user = firstTryUser;
         console.log("#### I am here #5 #####"); 
        res.render(
          'pages/sendMail',
          {
            display_name: firstTryUser.displayName,
            user_principal_name: firstTryUser.userPrincipalName
          }
        );
      } else if (hasAccessTokenExpired(firstRequestError)) {
       console.log("#### I am here #6 #####");    
        // Handle the refresh flow
        authHelper.getTokenFromRefreshToken(
          req.cookies.REFRESH_TOKEN_CACHE_KEY,
          function (refreshError, accessToken) {
            console.log("#### I am here #11 #####");
            res.cookie(authHelper.ACCESS_TOKEN_CACHE_KEY, accessToken);
            console.log("#### I am here #12 #####");
            if (accessToken !== null) {
             console.log('ACCESSTOKEN ****',accessToken); 
              requestUtil.getUserData(
                accessToken,  
                // ****** req.cookies.ACCESS_TOKEN_CACHE_KEY,
                function (secondRequestError, secondTryUser) {
                  if (secondTryUser !== null) {
                    req.session.user = secondTryUser;
                     console.log("#### I am here #7 #####"); 
                    res.render(
                      'pages/sendMail',
                      {
                        display_name: secondTryUser.displayName,
                        user_principal_name: secondTryUser.userPrincipalName
                      }
                    );
                  } else {
                    clearCookies(res);
                    console.log("#### I am here #8 #####"); 
                    //renderError(res, secondRequestError);
                  }
                }
              );
            } else {
              console.log("#### I am here #9 #####");   
              //renderError(res, refreshError);
              clearCookies(res);
              res.redirect('/o365/login');
            }
          });
      } else {
        console.log("#### I am here #10 #####"); 

        //renderError(res, firstRequestError);
        clearCookies(res);
        res.redirect('/o365/login');
      }
    }
  );
}

/********END HELPER FUNCTIONS *******/

module.exports = router;


//Google SDKs
const google = require('googleapis');
const googleAuth = require('google-auth-library');

//MongooseDB for Token store
var {mongoose} = require('../db/mongoose');
var {Oauth2Client} = require('../db/mtokens');

var accessToken;
var calendar = google.calendar('v3');
var auth = new googleAuth();



//Modify the Date class to add an addHours function
Date.prototype.addHours = function(h) {    
    this.setTime(this.getTime() + (h*60*60*1000)); 
    return this;   
}


function createEvent(date,time,emailaddress ) {

  console.log("#### I am in Google create FUNCTION  #####"); 
  console.log("Date", date);
  console.log("Time", time);
  console.log("emailaddress", emailaddress);


  let stTime = new Date(date +" "+ time + " GMT-0700" );
  let enTime = new Date(date +" "+ time + " GMT-0700" );

  console.log('^^^^^^^ startDateTime =', stTime);
  console.log('^^^^^^^ endDateTime =', enTime.addHours(1));

  var event = {
  'summary': 'Meeting with Kunal',
  'location': 'Silicon Valley',
  'description': 'This meeting is setup per request from ' + emailaddress,
  'start': {
    'dateTime': stTime,
    'timeZone': 'America/Los_Angeles',
  },
  'end': {
    'dateTime': enTime,
    'timeZone': 'America/Los_Angeles',
  },
//   'recurrence': [
//     'RRULE:FREQ=DAILY;COUNT=1'
//   ],
  'attendees': [
    {'email': emailaddress},
  ],
  'reminders': {
    'useDefault': false,
    'overrides': [
      {'method': 'email', 'minutes': 24 * 60},
      {'method': 'popup', 'minutes': 10},
    ],
  },
};

var oauth2Client1=new auth.OAuth2(
  '739725624072-s0pl5n494ek7pmm1bdeh84ubcjl7sc2b.apps.googleusercontent.com',
  'M9cXrkBGQ-JujTgyG2qOAAAe',
  'https://pointylabs.herokuapp.com/google/login'
);

Oauth2Client.find({}, (err, oauth2clients)=>{
    oauth2Client1.setCredentials(oauth2clients[0].credentials);    
    calendar.events.insert({
    auth: oauth2Client1,
    calendarId: 'primary',
    sendNotifications: true,
    resource: event,
    }, function(err, event) {
    if (err) {
     console.log('There was an error contacting the Calendar service: ' + err);
     return;
    }
    console.log('Event created: %s', event.htmlLink);
   });
  }
);

}

module.exports = {createEvent};
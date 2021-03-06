const apiai = require('apiai');
const uuid = require('uuid');
const bodyParser = require('body-parser');
const request = require('request');

const config = require('./../config');
const {createEvent} = require('./googlecalendar');

const sessionIds = new Map();

// API AI Setup
const apiAiService = apiai(config.API_AI_CLIENT_ACCESS_TOKEN, {
	language: "en",
	requestSource: "fb"
});

//Functions
function receivedMessage(event) {

	var senderID = event.sender.id;
	var recipientID = event.recipient.id;
	var timeOfMessage = event.timestamp;
	var message = event.message;

	if (!sessionIds.has(senderID)) {
		sessionIds.set(senderID, uuid.v1());
	}
	console.log("Received message for user %d and page %d at %d with message:", senderID, recipientID, timeOfMessage);
	console.log(JSON.stringify(message));

	var isEcho = message.is_echo;
	var messageId = message.mid;
	var appId = message.app_id;
	var metadata = message.metadata;

	// You may get a text or attachment but not both
	var messageText = message.text;

	if (isEcho) {
		handleEcho(messageId, appId, metadata);
		return;
	} 
	if (messageText) {
		//send message to api.ai
		sendToApiAi(senderID, messageText);
	} 
}

// Send received message to API.AI

function sendToApiAi(sender, text) {

	sendTypingOn(sender);
	let apiaiRequest = apiAiService.textRequest(text, {
		sessionId: sessionIds.get(sender)
	});

	apiaiRequest.on('response', (response) => {
		if (isDefined(response.result)) {
			handleApiAiResponse(sender, response);
		}
	});

	apiaiRequest.on('error', (error) => console.error(error));
	apiaiRequest.end();
}

function handleApiAiResponse(sender, response) {
	console.log("************Received Response from API AI**************");
	console.log(JSON.stringify(response));

	let responseText = response.result.fulfillment.speech;
	let messages = response.result.fulfillment.messages;
    let action = response.result.action;
	let contexts = response.result.contexts;
	let parameters = response.result.parameters;

	sendTypingOff(sender);

	if (responseText == '' ) {
		//api ai could not evaluate input.
		console.log('Unknown query' + response.result.resolvedQuery);
		sendTextMessage(sender, "Dude, I have no clue what you are saying. Try again...");
	} 

	// When the Action parameter is Defined for asking user info and meeting time/date

	else if (isDefined(action)) {
		handleApiAiAction(sender, action, responseText, contexts, parameters);
	} 
	
	//This is for Quick Reply buttons on facebook messenger
	 else if(messages.length >1) {
		let timeoutInterval = 1100;
        let timeout = 0;
		console.log("------ Received message from API.AI with a Quick Reply----");
		 for (let i=0; i<messages.length; i++)
		 {
			if (messages[i].platform == "facebook"){
			 console.log("------ I received a facebook quick reply----");
			 timeout = i * timeoutInterval;
			 setTimeout(handleMessage.bind(null, messages[i], sender), timeout); 
			}
		 }
	}
	else {
		sendTextMessage(sender, responseText);
	}
}

function sendTextMessage(recipientId, text) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			text: text
		}
	}
	callSendAPI(messageData);
	console.log("************End Request**************");
}

//https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-echo
//This callback will occur when a message has been sent by your page

function handleEcho(messageId, appId, metadata) {
	// Just logging message echoes to console
	console.log("Received echo for message %s and app %d with metadata %s", messageId, appId, metadata);
}

function receivedPostback(event) {
	var senderID = event.sender.id;
	var recipientID = event.recipient.id;
	var timeOfPostback = event.timestamp;

	// The 'payload' param is a developer-defined field which is set in a postback 
	// button for Structured Messages. 
	var payload = event.postback.payload;

	switch (payload) {
		default:
			//unindentified payload
			sendTextMessage(senderID, "I'm not sure what you want. Can you be more specific?");
			break;

	}

	console.log("Received postback for user %d and page %d with payload '%s' " +
		"at %d", senderID, recipientID, payload, timeOfPostback);

}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
	request({
		uri: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {
			access_token: config.FB_PAGE_TOKEN
		},
		method: 'POST',
		json: messageData

	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var recipientId = body.recipient_id;
			var messageId = body.message_id;

			if (messageId) {
				console.log("Successfully sent message with id %s to recipient %s",
					messageId, recipientId);

			} else {
				console.log("Successfully called Send API for recipient %s",
					recipientId);
			}

		} else {
			console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
		}
	});
}

function handleApiAiAction(sender, action, responseText, contexts, parameters) {

	switch (action) {
		case "Prompt-for-User-Info":
			if (parameters.hasOwnProperty("appointment-date") && parameters["appointment-time"] && parameters["user-email-add"]!='') {

				console.log('Appointment Date: '+ parameters["appointment-date"] );
				console.log('Appointment Time: '+ parameters["appointment-time"] );
				console.log('User Email Address: ' + parameters["user-email-add"] );
				createEvent(parameters["appointment-date"],parameters["appointment-time"], parameters["user-email-add"] );
				sendTextMessage(sender, responseText);

			} else {
				sendTextMessage(sender, responseText);
			}
			break;
		
		
		default:
			//unhandled action, just send back the text
			//console.log("send responce in handle actiongit: " + responseText);
			sendTextMessage(sender, responseText);
	}
}


function handleMessage(message, sender) {
	switch (message.type) {
		case 0: //text
			sendTextMessage(sender, message.speech);
			break;
		case 2: //quick replies
			let replies = [];
			for (var b = 0; b < message.replies.length; b++) {
				let reply =
				{
					"content_type": "text",
					"title": message.replies[b],
					"payload": message.replies[b]
				}
				replies.push(reply);
			}
			sendQuickReply(sender, message.title, replies);
			break;
		case 3: //image
			sendImageMessage(sender, message.imageUrl);
			break;
		case 4:
			// custom payload
			var messageData = {
				recipient: {
					id: sender
				},
				message: message.payload.facebook

			};
			console.log('custom payload');
			callSendAPI(messageData);

			break;
	}
}





function handleMessage(message, sender) {
	switch (message.type) {
		case 0: //text
			sendTextMessage(sender, message.speech);
			break;
		case 2: //quick replies
			let replies = [];
			for (var b = 0; b < message.replies.length; b++) {
				let reply =
				{
					"content_type": "text",
					"title": message.replies[b],
					"payload": message.replies[b]
				}
				replies.push(reply);
			}
			sendQuickReply(sender, message.title, replies);
			break;
		case 3: //image
			sendImageMessage(sender, message.imageUrl);
			break;
		case 4:
			// custom payload
			var messageData = {
				recipient: {
					id: sender
				},
				message: message.payload.facebook

			};
			console.log('custom payload');
			callSendAPI(messageData);

			break;
	}
}

/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId, text, replies, metadata) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			text: text,
			metadata: isDefined(metadata)?metadata:'',
			quick_replies: replies
		}
	};

	callSendAPI(messageData);
}

//Send indicator to FB Messager about the users typing action
function sendTypingOn(recipientId) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		sender_action: "typing_on"
	};

	callSendAPI(messageData);
}
function sendTypingOff(recipientId) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		sender_action: "typing_off"
	};

	callSendAPI(messageData);
}

function isDefined(obj) {
	if (typeof obj == 'undefined') {
		return false;
	}

	if (!obj) {
		return false;
	}

	return obj != null;
}



module.exports = {receivedMessage};
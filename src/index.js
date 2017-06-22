'use strict';
const https = require('https');
const Alexa = require('alexa-sdk');
const moment = require('moment');

const APP_ID = 'amzn1.ask.skill.985592fe-0d43-4002-a621-4e42eafee44d';
const SKILL_NAME = 'Comic Box';
const HELP_MESSAGE = 'You can say what is new';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';
const SORRY_MESSAGE = 'I am Sorry. I can not find what you are looking for.';
const NOT_FOUND_MESSAGE = 'No titles found.';
const handlers = {
  'LaunchRequest': function() {
    this.emit('GetComicList');
  },
  'GetComicList': function() {
    // get slots
    var publisher = this.event.request.intent.slots.publisher;
    var title = this.event.request.intent.slots.title;
    var date = this.event.request.intent.slots.date;

    // speak the comic list
    getComicList(publisher, title, date, function(result) {
      this.emit(':tell', result);
    }.bind(this));

  },
  'AMAZON.HelpIntent': function() {
    const speechOutput = this.t('HELP_MESSAGE');
    const reprompt = this.t('HELP_MESSAGE');
    this.emit(':ask', speechOutput, reprompt);
  },
  'AMAZON.CancelIntent': function() {
    this.emit(':tell', this.t('STOP_MESSAGE'));
  },
  'AMAZON.StopIntent': function() {
    this.emit(':tell', this.t('STOP_MESSAGE'));
  },
};

function getComicList(publisher, title, date, callback) {
  var url = 'https://api.shortboxed.com/comics/v1/query';

  //publisher=dc
  if (publisher && publisher.value) {
    url = addParam(url, 'publisher', publisher.value);
  }
  //title=batman
  if (title && title.value) {
    url = addParam(url, 'title', title.value);
  }
  //release_date=2017-06-21
  if (date && date.value) {
    var dateVal = date.value;
    // translate week into date
    if (dateVal.includes('W')) {
      var i = dateVal.indexOf('W');
      var week = dateVal.substring(i + 1, i + 3);
      dateVal = moment().day("Wednesday").week(week).format('YYYY-MM-DD');
    }
    url = addParam(url, 'release_date', dateVal);
  }

  https.get(url, function(res) {
    var apiResponse = '';
    res.on('data', function(chunk) {
      apiResponse += chunk;
    });
    res.on('end', function() {
      var apiResponseObj = JSON.parse(apiResponse);
      // api failed
      if (!apiResponse || !apiResponseObj) {
        callback(SORRY_MESSAGE);
      }
      // api returned error (i.e. title was not found)
      else if (apiResponseObj.error) {
        callback(NOT_FOUND_MESSAGE);
      }
      // api didn't return comics (api failed)
      else if (!apiResponseObj.comics) {
        callback(SORRY_MESSAGE);
      } else {
        var comicArray = apiResponseObj.comics;
        var comicTitleArray = [];
        for (var i = 0; i < comicArray.length; i++) {
          var comicTitle = comicArray[i].title;
          // only get 1st print comics. no TPBs, postcards, merchandise, or additional printings.
          if (comicTitle.includes('#') && !comicTitle.includes(' PTG') && !comicTitle.includes('POSTCARDS')) {
            // eliminate any text after the issue number
            // this will help us eliminate variants, special covers, etc.
            var regExArray = comicTitle.match(/.*(?:#)[0-9]+/);
            // '&' is not valid SSML
            comicTitle = regExArray[0].replace('&', 'and')
            comicTitleArray.push(comicTitle);
          }
        }
        // after removing, no comics were found
        if (!comicTitleArray.length || comicTitleArray.length == 0) {
          callback(NOT_FOUND_MESSAGE);
        }
        // SUCCESS!
        else {
          // sort alphabetically & remove duplicates
          comicTitleArray.sort()
          comicTitleArray = comicTitleArray.filter(function(elem, index, self) {
              return index == self.indexOf(elem);
            })
            //  callback results
          callback(comicTitleArray);
        }
      }
    });
  });
}

// add parameters to url accounting for ? or &
var addParam = function(base, key, value) {
  var sep = (base.indexOf('?') > -1) ? '&' : '?';
  return base + sep + key + '=' + value;
}

exports.handler = function(event, context) {
  const alexa = Alexa.handler(event, context);
  alexa.APP_ID = APP_ID;
  // To enable string internationalization (i18n) features, set a resources object.
  //alexa.resources = languageStrings;
  alexa.registerHandlers(handlers);
  alexa.execute();
};

'use strict';
const https = require('https');
const Alexa = require('alexa-sdk');
const moment = require('moment');

const APP_ID = 'amzn1.ask.skill.985592fe-0d43-4002-a621-4e42eafee44d';
const SKILL_NAME = 'Comic Box';
const HELP_MESSAGE = 'You can say what comics release this week';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';
const SORRY_MESSAGE = 'I am Sorry. I can not find what you are looking for.';
const NOT_FOUND_MESSAGE = 'No titles found.';
const INVALID_DATE_MESSAGE = 'I am Sorry. I can not search with that date.';

const handlers = {
  'LaunchRequest': function() {
    this.emit('GetComicList');
  },
  'GetComicList': function() {
    // get slots
    var publisher = this.event.request.intent.slots.publisher;
    var title = this.event.request.intent.slots.title;
    var date = this.event.request.intent.slots.date;

    // date translating (i.e. convert week number to date)
    if (date && date.value) {
      date = translateDate(date.value);
      // no support for searches by month or year, yet
      if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
        this.emit(':tell', INVALID_DATE_MESSAGE);
      }
    }
    // if no date slot, default to this week
    // comics are always released on Wednesday
    else {
      date = moment().day("Wednesday").format('YYYY-MM-DD');
    }

    // speak the comic list
    getComicList(publisher, title, date, function(result) {
      this.emit(':tell', 'For ' + date + ', ' + result);
    }.bind(this));
  },
  'AMAZON.HelpIntent': function() {
    this.emit(':ask', HELP_MESSAGE, HELP_MESSAGE);
  },
  'AMAZON.CancelIntent': function() {
    this.emit(':tell', STOP_MESSAGE);
  },
  'AMAZON.StopIntent': function() {
    this.emit(':tell', STOP_MESSAGE);
  },
};

function getComicList(publisher, title, date, callback) {
  var url = 'https://api.shortboxed.com/comics/v1/query';
  if (publisher && publisher.value) {
    var tmpPublisher = publisher.value;
    // replace and with & for publishers like Drawn & Quarterly
    tmpPublisher = tmpPublisher.replace('and', '&')
    url = addParam(url, 'publisher', tmpPublisher);
  }
  if (title && title.value) {
    var tmpTitle = title.value;
    // replace and with & for titles like Betty & Veronica
    tmpTitle = tmpTitle.replace('and', '&')
    url = addParam(url, 'title', tmpTitle);
  }
  if (date) {
    url = addParam(url, 'release_date', date);
  }

  console.log("url = " + url);

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
      }
      // valid api response
      else {
        var comicArray = apiResponseObj.comics;
        var comicTitleArray = [];
        // iterate through the comic list, grabbing just the titles
        for (var i = 0; i < comicArray.length; i++) {
          var comicTitle = comicArray[i].title;
          // only get comics with issues numbers; no additional printings or postcards.
          if (comicTitle.includes('#') && !comicTitle.includes(' PTG') && !comicTitle.includes('POSTCARDS')) {
            // eliminate any text after the issue number
            // helps eliminate variants, special covers, etc.
            var regExArray = comicTitle.match(/.*(?:#)[0-9]+/);
            // '&' is not valid SSML
            comicTitle = regExArray[0].replace('&', 'and')
            comicTitleArray.push(comicTitle);
          }
        }
        // after logic above, no comics were found
        if (!comicTitleArray.length || comicTitleArray.length == 0) {
          callback(NOT_FOUND_MESSAGE);
        }
        // SUCCESS!  We have a comic list.
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

// translate the week into a date
function translateDate(date) {
  // if the date includes a W (i.e. W25), translate the week into date
  if (date.includes('W')) {
    var i = date.indexOf('W');
    var week = date.substring(i + 1, date.length);
    // comics are always released on Wednesday
    date = moment().day("Wednesday").week(week).format('YYYY-MM-DD');
  }
  return date;
}

// this is where all the magic happens
exports.handler = function(event, context) {
  const alexa = Alexa.handler(event, context);
  alexa.APP_ID = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};

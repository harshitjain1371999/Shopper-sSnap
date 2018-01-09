
var jcrop, selection

var overlay = ((active) => (state) => {
  active = (typeof state === 'boolean') ? state : (state === null) ? active : !active
  $('.jcrop-holder')[active ? 'show' : 'hide']()
  chrome.runtime.sendMessage({message: 'active', active})
})(false)

makeblob = function (dataURL) {
  var BASE64_MARKER = ';base64,';
  if (dataURL.indexOf(BASE64_MARKER) == -1) {
    var parts = dataURL.split(',');
    var contentType = parts[0].split(':')[1];
    var raw = decodeURIComponent(parts[1]);
    return new Blob([raw], { type: contentType });
  }
  var parts = dataURL.split(BASE64_MARKER);
  var contentType = parts[0].split(':')[1];
  var raw = window.atob(parts[1]);
  var rawLength = raw.length;

  var uInt8Array = new Uint8Array(rawLength);

  for (var i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

var image = (done) => {
  var image = new Image()
  image.id = 'fake-image'
  image.src = chrome.runtime.getURL('/images/pixel.png')
  image.onload = () => {
    $('body').append(image)
    done()
  }
}

var init = (done) => {
  $('#fake-image').Jcrop({
    bgColor: 'none',
    onSelect: (e) => {
    selection = e
    capture()
  },
    onChange: (e) => {
    selection = e
  },
  onRelease: (e) => {
    setTimeout(() => {
      selection = null
    }, 100)
  }
}, function ready () {
    jcrop = this

    $('.jcrop-hline, .jcrop-vline').css({
      backgroundImage: 'url(' + chrome.runtime.getURL('/images/Jcrop.gif') + ')'
    })

    if (selection) {
      jcrop.setSelect([
        selection.x, selection.y,
        selection.x2, selection.y2
      ])
    }
    done && done()
  })
}

var capture = (force) => {
  chrome.storage.sync.get((config) => {
    if (selection && (config.method === 'crop' || (config.method === 'wait' && force))) {
      jcrop.release()
      setTimeout(() => {
        chrome.runtime.sendMessage({
          message: 'capture', area: selection, dpr: devicePixelRatio
        }, (res) => {
          overlay(false)
          selection = null
          save(res.image)
        })
      }, 50)
    }
    else if (config.method === 'view') {
      chrome.runtime.sendMessage({
        message: 'capture',
        area: {x: 0, y: 0, w: innerWidth, h: innerHeight}, dpr: devicePixelRatio
      }, (res) => {
        overlay(false)
        save(res.image)
      })
    }
  })
}

var filename = () => {
  var pad = (n) => ((n = n + '') && (n.length >= 2 ? n : '0' + n))
  var timestamp = ((now) =>
    [pad(now.getFullYear()), pad(now.getMonth() + 1), pad(now.getDate())].join('-')
    + ' - ' +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-')
)(new Date())
  return 'Screenshot Capture - ' + timestamp + '.jpeg'
}

var base64_image="";
var jpeg_image_blob;
// code to create base64 and binary image ..
var save = (image) => {
  var link = document.createElement('a')
  link.download = filename()
  link.href = image
  base64_image = image.substring(23)
  // link.click()
  jpeg_image_blob = makeblob(image)
  thread_genius(httpGetAsync)
  uploadImage()
  //console.log(chrome.tabs)
}

var urls=[];
var google_url;
var dress_color;
function AnalyzeJson(obj)
{
  var items = JSON.parse(obj).items;
  for(var i = 0; i < items.length; i++) {
    urls.push(items[i].link);
  }
  // console.log(urls)
  
}

function httpGetAsync(theUrl, callback)
{
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
      callback(xmlHttp.responseText);
  }
  xmlHttp.open("GET", theUrl, true); // true for asynchronous
  xmlHttp.send(null);
}

function uploadImage() {
  $.ajax({
    url: "https://api.tinify.com/shrink",
    beforeSend: function(xhr) {
      xhr.setRequestHeader("Authorization", "Basic " + btoa("TAcAByYeCF5O_ZvtrfXgM9nNxMkJmChD"));
    },
    type: 'POST',
    contentType: 'application/octet-stream',
    processData: false,
    data: jpeg_image_blob,
    success: function (data) {
      // console.log(JSON.stringify(data));
      google_url = "http://www.google.com/searchbyimage?image_url=" + data.output.url + "&q=site:www.amazon.in OR www.flipkart.com " + dress_color;
      urls.reverse(); urls.push(google_url);  urls.reverse();
      // console.log(urls);
      var numberOfTabs;
      chrome.storage.sync.get(function(obj){
        numberOfTabs =  obj.numberOfTabs;
        // console.log(numberOfTabs);
        chrome.runtime.sendMessage({
          message: 'search_urls',
          urls: urls,
          numberOfTabs : numberOfTabs
        })
      })
    },
    error: function(){
      console.log("Cannot get data");
    }
  });
}

function thread_genius(getUrl) {
  $.ajax({
    url: "https://api.threadgenius.co/v1/prediction/tag",
    beforeSend: function(xhr) {
      xhr.setRequestHeader("Authorization", "Basic " + btoa("key_NTQ1NWFhZTZkMjYzMWU0MDExNjE0ZWI1M2Y0NDFm:"));
    },
    type: 'POST',
    contentType: 'application/json',
    processData: false,
    data: '{"image": {"base64": "' + base64_image + '"}}',
    success: function (data) {
      // console.log(data);
      var query = "dress ";
      var tags = data.response.prediction.data.tags;
      for(var i = 0; i < 4; i++) {
        if (tags[i].type == 'color') {dress_color = tags[i].name;}
        query += tags[i].name + " ";
      }
      getUrl("https://www.googleapis.com/customsearch/v1?key= AIzaSyDYaHCU2-IXomCtfJHli2vbTFz_dpYJb_A&cx=006353239659194249938:xgm5kysoak8&fields=items(link)&q=" + query, AnalyzeJson);
    },
    error: function(){
      console.log("Cannot get data");
    }
  })
}

window.addEventListener('resize', ((timeout) => () => {
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    jcrop.destroy()
    init(() => overlay(null))
  }, 100)
})())

chrome.runtime.onMessage.addListener((req, sender, res) => {
  if (req.message === 'init') {
    res({}) // prevent re-injecting

    if (!jcrop) {
      image(() => init(() => {
        overlay()
        capture()
      }))
    }
    else {
      overlay()
      capture(true)
    }
  }
return true
})

"use strict";

var Cc = Components.classes, Ci = Components.interfaces, Cu = Components.utils, Cr = Components.results;
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var Storage = {
  website: new Object(),
  option: new Object(),
  player: new Object(),
  filter: new Object(),
  file: {
    server: "https://bitbucket.org/kafan15536900/haoutil/raw/master/player/testmod/",
    folder: Services.dirsvc.get("ProfD", Ci.nsIFile).path + "\\soWatch"
  }
};

/** Please match the preference name in options.xul
    请保证 设置名 与 options.xul 中相同 */
var Option = [
  ["offline", "bool", false, false],
  ["server", "string", "", true]
];

/** Some sites have shared player/filter rule, use the template sample
    一部分网站的 player 或 filter 规则是通用的，请参考下面的模板进行添加 */
var Wrapper = [
  ["filter", "youku", ["tudou"]] // 第一个是规则类型，第二个是主要参考，修改它的参数设置会影响后面的子站点。
];

var Website = [
/**  Template sample for new site
     请参考下面模板添加新站点  */
  [
    "youku", // 站点名称
    0, // 默认规则： 0，禁用、 1，替换播放器、 2，过滤XML请求
    /youku\.com/i, // 匹配域名
    [true, [["youku_loader", "loader.swf", true, null, /http:\/\/static\.youku\.com\/.*\/v\/swf\/loaders?\.swf/i], ["youku_player", "player.swf", true, null, /http:\/\/static\.youku\.com\/.*\/v\/swf\/q?player.*\.swf/i]]],
    [true, [["youku_filter", null, null, true, /http:\/\/val[fcopb]\.atm\.youku\.com\/v[fcopb]/i]]]
  ],
/**  Template End
     模板结束  */
  [
    "tudou",
    0,
    /tudou\.com/i,
    [true, [["tudou_portal", "tudou.swf", true, null, /http:\/\/js\.tudouui\.com\/bin\/lingtong\/PortalPlayer.*\.swf/i]]],
    [true, [["tudou_filter", null, null, false, /http:\/\/val[fcopb]\.atm\.youku\.com\/v[fcopb]/i]]]
  ],
  [
    "iqiyi",
    0,
    /iqiyi\.com/i,
    [true, [["iqiyi_v5", "iqiyi5.swf", true, null, /http:\/\/www\.iqiyi\.com\/common\/flashplayer\/\d+\/MainPlayer.*\.swf/i], ["iqiyi_out", "iqiyi_out.swf", true, null, /https?:\/\/www\.iqiyi\.com\/(common\/flash)?player\/\d+\/(Share|Enjoy)?Player.*\.swf/i]]],
    [true, [["iqiyi_filter", null, null, false, /http:\/\/(\w+\.){3}\w+\/videos\/other\/\d+\/(\w{2}\/){2}\w{32}\.(f4v|hml)/i]]]
  ],
  [
    "letv",
    0,
    /letv\.com/i,
    [true, [["letv_player", "letv.swf", true, null, /http:\/\/.*\.letv(cdn)?\.com\/.*(new)?player\/((SDK)?Letv|swf)Player\.swf/i], ["letv_pccs", "http://www.letv.com/cmsdata/playerapi/pccs_sdk_20141113.xml", false, null, /http:\/\/www.letv.com\/.*\/playerapi\/pccs_(?!(.*live|sdk)).*_?(\d+)\.xml/i]]],
    [true, [["letv_filter", null, null, false, /http:\/\/(\d+\.){3}\d+\/(\d{1,3}\/){3}letv-gug\/\d{1,3}\/ver.+avc.+aac.+\.letv/i], ["letv_pause", null, null, false, /http:\/\/i\d\.letvimg\.com\/lc\d+_(gugwl|diany)\/(\d+\/){4}.*\.(jpg|swf)/i]]]
  ],
  [
    "sohu",
    0,
    /sohu\.com/i,
    [true, [["sohu_player", "sohu_live.swf", true, null, /http:\/\/(tv\.sohu\.com\/upload\/swf\/(p2p\/|56\/)?\d+|(\d+\.){3}\d+\/webplayer)\/Main\.swf/i]]],
    [true, [["sohu_filter", null, null, true, /http:\/\/v\.aty\.sohu\.com\/v/i]]]
  ],
  [
    "pptv",
    0,
    /pptv\.com/i,
    [true, [["pptv_player", "player4player2.swf", true, null, /http:\/\/player.pplive.cn\/ikan\/.*\/player4player2\.swf/i]]],
    [true, [["pptv_filter", null, null, false, /http:\/\/de\.as\.pptv\.com\/ikandelivery\/vast\/.+draft/i]]]
  ],
  [
    "qq",
    0,
    /qq\.com/i,
    [false, []],
    [true, [["qq_filter", null, null, false, /http:\/\/(\d+\.){3}\d+\/vmind\.qqvideo\.tc\.qq\.com\/.*\.mp4\?vkey/i], ["qq_pause", null, null, false, /http:\/\/\w+\.gtimg\.com\/qqlive\//i]]]
  ]
];

function readList() {
  Option.forEach(function (element, index, array) {
    var name = element[0], type = element[1], value = element[2], ignore = element[3];
    if (value != "command") {
      Storage.option[name] = {
        prefs: {name: name, type: type, value: value},
        ignore: ignore
      };
    }
  });

  Website.forEach(function (element, index, array) {
    var name = element[0], value = element[1], pattern = element[2], player = element[3], filter = element[4];
    Storage.website[name] = {
      prefs: {name: name, type: "integer", value: value},
      onSite: pattern,
      hasPlayer: player[0],
      player: player[1],
      hasFilter: filter[0],
      filter: filter[1]
    };
  });
}

function readOption() {
  for (var i in Storage.option) {
    try {
      Preference.getValue(Storage.option[i].prefs);
    } catch (e) {
      Preference.setValue(Storage.option[i].prefs);
    } finally {
      Storage.option[i].value = Preference.getValue(Storage.option[i].prefs);
    }
  }

  if (Storage.option["server"].value) Storage.file.link = Storage.option["server"].value;
  else Storage.file.link = Storage.file["server"];

  Storage.file.path = "file:///" + Storage.file["folder"].replace(/\\/g, "/") + "/";

  pendingOption();
  handleWrapper();
}

function pendingOption() {
  for (var i in Storage.website) {
    try {
      Preference.getValue(Storage.website[i].prefs)
    } catch (e) {
      Preference.setValue(Storage.website[i].prefs)
    } finally {
      Storage.website[i].value = Preference.getValue(Storage.website[i].prefs);

      if (Storage.website[i].hasPlayer) {
        getRule(Storage.website[i].player);
        if (Storage.website[i].value == 1) setRule("on", "player", Storage.website[i].player);
        else setRule("off", "player", Storage.website[i].player);
      } else {
        if (Storage.website[i].value == 1) Preference.setValue(Storage.website[i].prefs);
      }

      if (Storage.website[i].hasFilter) {
        getRule(Storage.website[i].filter);
        if (Storage.website[i].value == 2) setRule("on", "filter", Storage.website[i].filter);
        else setRule("off", "filter", Storage.website[i].filter);
      } else {
        if (Storage.website[i].value == 2) Preference.setValue(Storage.website[i].prefs);
      }

      if (Storage.website[i].value > 2) Preference.setValue(Storage.website[i].prefs);
    }
  }
}

function handleWrapper() {
  Wrapper.forEach(function (element, index, array) {
    var entry = element[0], major = element[1], minor = element[2];
    minor.forEach(function (element, index, array) {
      major = Storage.website[major], minor = Storage.website[element];
      if (entry == "player") {
        if ((major.value == 1 && minor.value != 1) || (major.value != 1 && minor.value == 1)) {
          Preference.setValue(minor.prefs, major.value);
        }
      }
      if (entry == "filter") {
        if ((major.value == 2 && minor.value == 0) || (major.value == 0 && minor.value == 2)) {
          Preference.setValue(minor.prefs, major.value);
        }
      }
    });
  });
}

function getRule(rulelist) {
  rulelist.forEach(function (element, index, array) {
    var name = element[0], player = element[1], remote = element[2], filter = element[3], pattern = element[4];
    if (player != undefined) {
      if (!remote) {
        Storage.player[name] = {
          offline: player,
          pattern: pattern
        };
      } else {
          Storage.player[name] = {
          offline: Storage.file.path + player,
          online: Storage.file.link + player,
          pattern: pattern
        };
      }
    }
    if (filter != undefined) {
      Storage.filter[name] = {
        secured: filter,
        pattern: pattern
      };
    }
  });
}

function setRule(state, type, rulelist) {
  rulelist.forEach(function (element, index, array) {
    var object = Storage[type][element[0]];
    if (state == "on") {
      object["target"] = object["pattern"];
    }
    if (state == "off") {
      object["target"] = null;
    }
  });
}

var Preference = {
  branch: Services.prefs.getBranch("extensions.sowatch."),
  getValue: function (probe) {
    if (probe.type == "bool") {
      return this.branch.getBoolPref(probe.name);
    }
    if (probe.type == "integer") {
      return this.branch.getIntPref(probe.name);
    }
    if (probe.type == "string") {
      return this.branch.getComplexValue(probe.name, Ci.nsISupportsString).data;
    }
  },
  setValue: function (probe, value) {
    if (value == undefined) value = probe.value;
    if (probe.type == "bool") {
      this.branch.setBoolPref(probe.name, value);
    }
    if (probe.type == "integer") {
      this.branch.setIntPref(probe.name, value);
    }
    if (probe.type == "string") {
      var character = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
      character.data = value;
      this.branch.setComplexValue(probe.name, Ci.nsISupportsString, character);
    }
  },
  remove: function () {
    Services.prefs.deleteBranch("extensions.sowatch.");
  }
};

var HttpRequest = {
  getPlayer: function (object, rule, request) {
    request.suspend();
    NetUtil.asyncFetch(object, function (inputStream, status) {
      var binaryOutputStream = Cc["@mozilla.org/binaryoutputstream;1"].createInstance(Ci.nsIBinaryOutputStream);
      var storageStream = Cc["@mozilla.org/storagestream;1"].createInstance(Ci.nsIStorageStream);
      var count = inputStream.available();
      var data = NetUtil.readInputStreamToString(inputStream, count);
      storageStream.init(512, count, null);
      binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));
      binaryOutputStream.writeBytes(data, count);
      rule["storageStream"] = storageStream;
      rule["count"] = count;
      request.resume();
    });
  },
  getFilter: function (rule, request) {
    if (rule["secured"]) request.suspend();
    else request.cancel(Cr.NS_BINDING_ABORTED);
  },
  filter: function (subject) {
    var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);

    for (var i in Storage.filter) {
      var rule = Storage.filter[i];
      if (rule["target"] && rule["target"].test(httpChannel.URI.spec)) {
        if (i.includes("iqiyi")) {  // issue #7 细节补丁
          this.iqiyi ++;
          if (this.iqiyi != 2) this.getFilter(rule, httpChannel);
        } else {
          this.getFilter(rule, httpChannel);
        }
      }
    }
  },
  player: function (subject) {
    var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);

    if (!httpChannel.URI.spec.match(/\.(swf|xml)/i)) return;

    for (var i in Storage.website) {
      if (Storage.website[i].onSite.test(httpChannel.URI.host)) {
        if (i == "iqiyi") { // issues #7 前置补丁
          this.iqiyi = 0; 
        }
        Storage.website[i].popup = true;
      } else {
        Storage.website[i].popup = false;
      }
    }

    for (var i in Storage.player) {
      var rule = Storage.player[i];
      if (rule["target"] && rule["target"].test(httpChannel.URI.spec)) {
        if (!rule["storageStream"] || !rule["count"]) {
          if (Storage.option["offline"].value) {
            this.getPlayer(rule.offline, rule, httpChannel);
          } else {
            this.getPlayer(rule.online, rule, httpChannel);
		  }
        }
        var newListener = new TrackingListener();
        subject.QueryInterface(Ci.nsITraceableChannel);
        newListener.originalListener = subject.setNewListener(newListener);
        newListener.rule = rule;
        break;
      }
    }
  }
};

function TrackingListener() {
  this.originalListener = null;
  this.rule = null;
}
TrackingListener.prototype = {
  onStartRequest: function (request, context) {
    this.originalListener.onStartRequest(request, context);
  },
  onStopRequest: function (request, context) {
    this.originalListener.onStopRequest(request, context, Cr.NS_OK);
  },
  onDataAvailable: function (request, context) {
    this.originalListener.onDataAvailable(request, context, this.rule["storageStream"].newInputStream(0), 0, this.rule["count"]);
  }
}

var Observer = {
  observe: function (subject, topic, data) {
    if (topic == "addon-options-displayed" && data == "sowatch@jc3213.github") {
      var document = subject.QueryInterface(Ci.nsIDOMDocument);

      var alphaButton = document.getElementById("sowatch-reset");
      alphaButton.addEventListener("command", this.restoreDefault);

      var betaButton = document.getElementById("sowatch-newtab");
      betaButton.addEventListener("command", this.openNewWebPage);

      var gammaButton = document.getElementById("sowatch-opendir");
      gammaButton.addEventListener("command", this.openDirectory);
    }
    if (topic == "nsPref:changed") {
      readOption();
    }
    if (topic == "http-on-examine-response") {
      HttpRequest.player(subject);
      HttpRequest.filter(subject);
    }
  },
  openDirectory: function (event) {
    var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(Storage.file.folder);
    file.reveal();
  },
  openNewWebPage: function (event) {
    var window = Services.wm.getMostRecentWindow("navigator:browser");
    window.gBrowser.selectedTab = window.gBrowser.addTab(Storage.link);
  },
  restoreDefault: function (event) {
    for (var i in Storage.option) {
      if (Storage.option[i].ignore) continue;
      Preference.setValue(Storage.option[i].prefs);
    }
    for (var x in Storage.website) {
      Preference.setValue(Storage.website[x].prefs);
    }
  },
  process: function () {
    Preference.branch.addObserver("", this, false);
    Services.obs.addObserver(this, "addon-options-displayed", false);
    Services.obs.addObserver(this, "http-on-examine-response", false);
  },
  suspend: function () {
    Preference.branch.removeObserver("", this);
    Services.obs.addObserver(this, "addon-options-displayed", false);
    Services.obs.removeObserver(this, "http-on-examine-response", false);
  },
};

function startup(data, reason) {
  readList();
  readOption();
  Observer.process();
}

function shutdown(data, reason) {
  Observer.suspend();
}

function install(data, reason) {}

function uninstall(data, reason) {
  if (reason == ADDON_UNINSTALL) {
    Preference.remove();
  }
}

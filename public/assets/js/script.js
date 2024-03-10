function _assert(desc, v) {
  if (v) {
    return;
  } else {
    let caller = _assert.caller || "Top level";
    console.error("ASSERT in %s, %s is :", caller, desc, v);
  }
}

toastr.options = {
  "timeOut": "5000",
};

var ua = window.navigator.userAgent.toLowerCase();
// alert(ua)
var osStr = ""
if (ua.indexOf("windows nt") !== -1) {
  // alert("os:windows")
  osStr = "pc"
} else if (ua.indexOf("android") !== -1) {
  // alert("os:android")
  osStr = "android"
} else if (ua.indexOf("iphone") !== -1 || ua.indexOf("ipad") !== -1 || ua.indexOf("version") !== -1) {
  // alert("os:ios")
  osStr = "mobile"
} else if (ua.indexOf("mac os x") !== -1) {
  // alert("os:mac")
  osStr = "pc"
} else {
  // alert("os:other")
  osStr = "pc"
}


// 表示モードのシグナル制御
var modeIntervalControler;

var isAudienceMode = false

// ビデオのON/OFFフラグ
var videoSwitchFlg = false
// マイクのON/OFFフラグ
var micSwitchFlg = false
// 共有のON/OFFフラグ
var captureSwitchFlg = false

// デバイスのメディアにアクセス
let localVideo = document.getElementById("local_video");
let localStream = null;

// 複数接続用にピアコネクションの準備
let peerConnections = [];
let remoteVideos = [];
const MAX_CONNECTION_COUNT = 20;

// --- multi video ---
let container = document.getElementById("container");
_assert("container", container);

// --- prefix -----
navigator.getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia;
RTCPeerConnection =
  window.RTCPeerConnection ||
  window.webkitRTCPeerConnection ||
  window.mozRTCPeerConnection;
RTCSessionDescription =
  window.RTCSessionDescription ||
  window.webkitRTCSessionDescription ||
  window.mozRTCSessionDescription;

// ----------------------------------------------------------------
// ---------------------- SOCKET.IOの設定  -----------------------
// ----------------------------------------------------------------

// ----- use socket.io ---
let port = 3000;
let socket = io('https://conference.aice.cloud:8446');
let room = getRoomName();

socket.on("connect", function (evt) {
  console.log("socket.io connected. enter room=" + room);
  socket.emit("enter", room);
});
socket.on("message", function (message) {
  console.log("message:", message);
  let fromId = message.from;

  if (message.type === "offer") {
    // -- got offer ---
    console.log("Received offer ...");
    let offer = new RTCSessionDescription(message);
    setOffer(fromId, offer);
  } else if (message.type === "answer") {
    // --- got answer ---
    console.log("Received answer ...");
    let answer = new RTCSessionDescription(message);
    setAnswer(fromId, answer);
  } else if (message.type === "candidate") {
    // --- got ICE candidate ---
    console.log("Received ICE candidate ...");
    let candidate = new RTCIceCandidate(message.ice);
    console.log(candidate);
    addIceCandidate(fromId, candidate);
  } else if (message.type === "call me") {
    if (!isReadyToConnect()) {
      console.log("Not ready to connect, so ignore");
      return;
    } else if (!canConnectMore()) {
      console.warn("TOO MANY connections, so ignore");
    }

    if (isConnectedWith(fromId)) {
      // already connnected, so skip
      console.log("already connected, so ignore");
    } else {
      // connect new party
      makeOffer(fromId);
    }
  } else if (message.type === "bye") {
    if (isConnectedWith(fromId)) {
      stopConnection(fromId);
    }
  }
});
socket.on("user disconnected", function (evt) {
  console.log("====user disconnected==== evt:", evt);
  let id = evt.id;
  if (isConnectedWith(id)) {
    stopConnection(id);
  }
});

socket.on("chat", function (msg) {
  // $("#chat").append($("<li>").text(msg));
  $("#notice_se").get(0).play();
  vue.addContent(msg);
});

socket.on("alert", function (msg) {
  toastr.success(msg);
  $("#se").get(0).play();
});

socket.on("being", function (msg) {
  var text = msg;
  const words = text.split("---");
  // 名前欄を更新する
  if ($("#user_name_" + words[1]).text() !== words[0]) {
    $("#user_name_" + words[1]).text(words[0]);
  }
  // メンバー一覧を更新する
  vue.updateMemberList(msg);
});

/**
 * 画面共有シグナルを受けた時
 */
/*
socket.on("presen", function (msg) {
  console.log("recieve presen signal..." + msg)
  vue.setPresenClass(msg);
  if (!isAudienceMode) {
    toastr.success("画面共有中のため、カメラ機能を制限しています。");
    setWideMode();
    isAudienceMode = true
  }
  stopVideo();
  $("#videobutton").addClass("fab-disable");
  $("#capturebutton").addClass("fab-disable");
});
socket.on("presenEnd", function (msg) {
  vue.resetPresenClass();
  isAudienceMode = false
  if (videoSwitchFlg) {
    startVideo();
  }
  $("#videobutton").removeClass("fab-disable");
  $("#capturebutton").removeClass("fab-disable");
});
*/
socket.on("presen", function (msg) {
  vue.setPresenClass(msg);
  if (!vue.isAudienceMode) {
    vue.isAudienceMode = true
  }
  stopVideo();
});
socket.on("presenEnd", function (msg) {
  vue.resetPresenClass();
  vue.isAudienceMode = false;
  startVideo();
});

socket.on("vote", function (msg) {
  vue.vote(msg);
});

socket.on("roomhash", function (msg) {
  showLinkWindow(msg);
});

// --- broadcast message to all members in room
function emitRoom(msg) {
  socket.emit("message", msg);
}

function emitTo(id, msg) {
  msg.sendto = id;
  socket.emit("message", msg);
}

// -- room名を取得 --
function getRoomName() {
  /* パラメータで指定する場合
      let url = document.location.href;
      let args = url.split("?");
      if (args.length > 1) {
        let room = args[1];
        if (room != "") {
          console.log("RoomName:" + room);
          return room;
        }
      }
      return "_testroom";
      */

  // 埋め込みで指定する場合
  let args = $("#room_id").val();
  if (args == "") {
    return "_testroom";
  }
  return args;
}

// ---- for multi party -----
function isReadyToConnect() {
  if (localStream) {
    return true;
  } else {
    return false;
  }
}

// --- RTCPeerConnections ---
function getConnectionCount() {
  return peerConnections.length;
}

function canConnectMore() {
  return getConnectionCount() < MAX_CONNECTION_COUNT;
}

function isConnectedWith(id) {
  if (peerConnections[id]) {
    return true;
  } else {
    return false;
  }
}

function addConnection(id, peer) {
  _assert("addConnection() peer", peer);
  _assert("addConnection() peer must NOT EXIST", !peerConnections[id]);
  peerConnections[id] = peer;
}

function getConnection(id) {
  let peer = peerConnections[id];
  _assert("getConnection() peer must exist", peer);
  return peer;
}

function deleteConnection(id) {
  _assert("deleteConnection() peer must exist", peerConnections[id]);
  delete peerConnections[id];
}

function stopConnection(id) {
  detachVideo(id);

  if (isConnectedWith(id)) {
    let peer = getConnection(id);
    peer.close();
    deleteConnection(id);
  }
}

function stopAllConnection() {
  for (let id in peerConnections) {
    stopConnection(id);
  }
}

// ----------------------------------------------------------------
// ---------------------- ビデオ要素の管理  -----------------------
// ----------------------------------------------------------------

// --- video elements ---
function attachVideo(id, stream) {
  let video = addRemoteVideoElement(id);
  playVideo(video, stream);
  video.volume = 1.0;

  $("#remote_video_" + id).wrap(
    '<div class="videowrapper" id="video_container_' + id + '"/>'
  );
  $("#remote_video_" + id).after(
    '<p class="membername" id="user_name_' + id + '">　</p>'
  );
  vue.editVideoClass();
}

function detachVideo(id) {
  let video = getRemoteVideoElement(id);
  pauseVideo(video);
  deleteRemoteVideoElement(id);

  // $('#remote_video_'+id).remove();
  $("#video_container_" + id).remove();

  // ビデオ数をカウントダウン
  vue.removeVideoCount();

  // ダミービデオ要素を追加
  // addBlankVideoElement();

  vue.editVideoClass();
}

function isRemoteVideoAttached(id) {
  if (remoteVideos[id]) {
    return true;
  } else {
    return false;
  }
}

function addRemoteVideoElement(id) {
  _assert("addRemoteVideoElement() video must NOT EXIST", !remoteVideos[id]);
  let video = createVideoElement("remote_video_" + id);
  remoteVideos[id] = video;
  return video;
}

function getRemoteVideoElement(id) {
  let video = remoteVideos[id];
  _assert("getRemoteVideoElement() video must exist", video);
  return video;
}

function deleteRemoteVideoElement(id) {
  _assert("deleteRemoteVideoElement() stream must exist", remoteVideos[id]);
  //removeVideoElement("remote_video_" + id);
  removeVideoWrapperElement("video_container_" + id);
  delete remoteVideos[id];
}

function createVideoElement(elementId) {
  // ダミービデオを一つ削除
  // removeBlankVideoElement();

  // ビデオ数をカウントアップ
  vue.addVideoCount();

  // ビデオ要素を作成
  let video = document.createElement("video");
  video.id = elementId;
  video.className = "membersvideo";
  video.controls = true;
  video.playsInline = true;
  container.prepend(video);
  return video;
}

// 元の処理
function removeVideoElement(elementId) {
  let video = document.getElementById(elementId);
  _assert("removeVideoElement() video must exist", video);

  container.removeChild(video);
  return video;
}

// DIVでラップしてるので、DIVごと削除
function removeVideoWrapperElement(elementId) {
  let wrapper = document.getElementById(elementId);
  _assert("removeVideoWrapperElement() video must exist", wrapper);

  //container.remove(wrapper);
  $("#" + elementId).remove();
}

// ----------------------------------------------------------------
// ---------------------- ボタン操作  -----------------------
// ----------------------------------------------------------------

// connect video
function connectVideo() {
  // var videoParam = getVideoParam()
  var videoParam = getDynamicVideoParam()

  getDeviceStream(videoParam) // audio: false <-- ontrack once, audio:true --> ontrack twice!!
    .then(function (stream) {
      // success

      // 取得したメディア情報をぶち込む
      localStream = stream;

      // 自分のビデオを再生する
      playVideo(localVideo, stream);

      // ビデオ・音声の送信をポーズ
      stopVideo();
      stopVoice();

      connect();
    })
    .catch(function (error) {
      // error
      console.error("getUserMedia error:", error);
      return;
    });
  return false;
}

async function setCaptureVideo() {
  var videoParam = {
    audio: true,
    video: {
      frameRate: { max: 5 },
    },
  };

  var result = false;
  await navigator.mediaDevices
    .getDisplayMedia(videoParam)
    .then((stream) => {
      var tracks = localStream.getAudioTracks();

      // 取得したメディア情報をぶち込む
      localStream = stream;
      localStream.addTrack(tracks[0]);
      playVideo(localVideo, stream);

      if (micSwitchFlg) {
        startVoice();
      } else {
        stopVoice();
      }
      startVideo();

      result = true
    })
    .catch((error) => {
      console.error("getDisplayMedia error:", error);
    });
  return result
}
function setCameraVideo() {

  var videoParam = getVideoParam()

  getDeviceStream(videoParam)
    .then((stream) => {
      localStream = stream;

      playVideo(localVideo, stream);

      if (micSwitchFlg) {
        startVoice();
      } else {
        stopVoice();
      }
      if (videoSwitchFlg) {
        startVideo();
      } else {
        stopVideo();
      }
    })
    .catch((error) => {
      console.error("getDisplayMedia error:", error);
      return;
    });
}

function getDynamicVideoParam() {
  var videoParam = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100
    },
    video: {
      width: 320,
      height: 240,
      frameRate: 15,
      aspectRatio: { ideal: 1.333 },
      facingMode: "user"
    },
  }
  return videoParam;
}

function getVideoParam() {
  var videoParam
  if (osStr == "pc") {
    videoParam = {
      audio: true,
      video: {
        width: 320,
        height: 240,
        frameRate: { ideal: 15, max: 20 },
        aspectRatio: { ideal: 1.333 },
        facingMode: "user"
      },
    }
  } else if (osStr == "android") {
    videoParam = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      },
      video: {
        width: 240,
        height: 240,
        frameRate: { ideal: 15, max: 20 },
        facingMode: "user"
      },
    }
  } else if (osStr == "mobile") {
    videoParam = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      },
      video: {
        width: 240,
        height: 240,
        frameRate: { ideal: 15, max: 20 },
        facingMode: "user"
        /*
        width: 240,
        frameRate: { ideal: 15, max: 20 },
        aspectRatio: 1.333,
        facingMode: "user"
        */
        /*
        height: 240,
        frameRate: { ideal: 15, max: 20 },
        aspectRatio: 1.333,
        facingMode: "user"
        */
      },
    }
  }
  return videoParam
}

function sendChat() {
  if ($("#input_msg").val().length == 0) {
    toastr.error("文字を入力してください");
  } else {
    var text = $("#user_name").val() + " : " + $("#input_msg").val();
    //$("#chat").append($("<li>").text(text));
    socket.emit("chat", text);

    vue.addContent(text);
    $("#input_msg").val("");
  }
  return false;
}

function sendBeing() {
  var message = $("#user_name").val() + "---" + socket.id;
  socket.emit("being", message);
  return false;
}

/**
 * 画面共有モード発令中のシグナル
 */
function sendPresenSign() {
  var message = socket.id;
  socket.emit("presen", message);
  return false;
}
function sendPresenEnd() {
  var message = socket.id;
  socket.emit("presenEnd", message);
  return false;
}

function stopLocalStream(stream) {
  let tracks = stream.getTracks();
  if (!tracks) {
    console.warn("NO tracks");
    return;
  }

  for (let track of tracks) {
    track.stop();
  }
}

function getDeviceStream(option) {
  if ("getUserMedia" in navigator.mediaDevices) {
    console.log("navigator.mediaDevices.getUserMadia");
    return navigator.mediaDevices.getUserMedia(option);
  } else {
    console.log("wrap navigator.getUserMadia with Promise");
    return new Promise(function (resolve, reject) {
      navigator.getUserMedia(option, resolve, reject);
    });
  }
}

function playVideo(element, stream) {
  if ("srcObject" in element) {
    element.srcObject = stream;
  } else {
    element.src = window.URL.createObjectURL(stream);
  }
  element.play();
  element.volume = 0;
}

function pauseVideo(element) {
  element.pause();
  if ("srcObject" in element) {
    //element.srcObject = null;
  } else {
    if (element.src && element.src !== "") {
      window.URL.revokeObjectURL(element.src);
    }
    element.src = "";
  }
}

function sendSdp(id, sessionDescription) {
  console.log("---sending sdp ---");
  let message = {
    type: sessionDescription.type,
    sdp: sessionDescription.sdp,
  };
  console.log("sending SDP=" + message);
  //ws.send(message);
  emitTo(id, message);
}

function sendIceCandidate(id, candidate) {
  console.log("---sending ICE candidate ---");
  let obj = { type: "candidate", ice: candidate };
  if (isConnectedWith(id)) {
    emitTo(id, obj);
  } else {
    console.warn("connection NOT EXIST or ALREADY CLOSED. so skip candidate");
  }
}

// ----------------------------------------------------------------
// ---------------------- ピアコネクションの管理  -----------------------
// ----------------------------------------------------------------
function prepareNewConnection(id) {
  // ネットワーク超えする場合
  let pc_config = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };
  let peer = new RTCPeerConnection(pc_config);

  // ローカルネットワークのみの場合
  // let pc_config = { iceServers: [] };
  // let peer = new RTCPeerConnection(pc_config);

  // --- on get remote stream ---
  if ("ontrack" in peer) {
    peer.ontrack = function (event) {
      let stream = event.streams[0];
      console.log("-- peer.ontrack() stream.id=" + stream.id);
      if (isRemoteVideoAttached(id)) {
        console.log("stream already attached, so ignore");
      } else {
        //playVideo(remoteVideo, stream);
        attachVideo(id, stream);
      }
    };
  } else {
    peer.onaddstream = function (event) {
      let stream = event.stream;
      console.log("-- peer.onaddstream() stream.id=" + stream.id);
      //playVideo(remoteVideo, stream);
      attachVideo(id, stream);
    };
  }

  // --- on get local ICE candidate
  peer.onicecandidate = function (evt) {
    if (evt.candidate) {
      console.log(evt.candidate);

      // Trickle ICE の場合は、ICE candidateを相手に送る
      sendIceCandidate(id, evt.candidate);

      // Vanilla ICE の場合には、何もしない
    } else {
      console.log("empty ice event");
    }
  };

  // --- when need to exchange SDP ---
  peer.onnegotiationneeded = function (evt) {
    console.log("-- onnegotiationneeded() ---");
  };

  // --- other events ----
  peer.onicecandidateerror = function (evt) {
    console.error("ICE candidate ERROR:", evt);
  };

  peer.onsignalingstatechange = function () {
    console.log("== signaling status=" + peer.signalingState);
  };

  peer.oniceconnectionstatechange = function () {
    console.log("== ice connection status=" + peer.iceConnectionState);
    if (peer.iceConnectionState === "disconnected") {
      console.log("-- disconnected --");
      stopConnection(id);
    }
  };

  peer.onicegatheringstatechange = function () {
    console.log("==***== ice gathering state=" + peer.iceGatheringState);
  };

  peer.onconnectionstatechange = function () {
    console.log("==***== connection state=" + peer.connectionState);
  };

  peer.onremovestream = function (event) {
    console.log("-- peer.onremovestream()");
    deleteRemoteStream(id);
    detachVideo(id);
  };

  // -- add local stream --
  if (localStream) {
    console.log("Adding local stream...");
    // peer.addStream(localStream);
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream))
  } else {
    console.warn("no local stream, but continue.");
  }

  return peer;
}

function makeOffer(id) {
  _assert("makeOffer must not connected yet", !isConnectedWith(id));
  peerConnection = prepareNewConnection(id);
  addConnection(id, peerConnection);

  peerConnection
    .createOffer()
    .then(function (sessionDescription) {
      console.log("createOffer() succsess in promise");
      return peerConnection.setLocalDescription(sessionDescription);
    })
    .then(function () {
      console.log("setLocalDescription() succsess in promise");

      // -- Trickle ICE の場合は、初期SDPを相手に送る --
      sendSdp(id, peerConnection.localDescription);

      // -- Vanilla ICE の場合には、まだSDPは送らない --
    })
    .catch(function (err) {
      console.error(err);
    });
}

function setOffer(id, sessionDescription) {
  _assert("setOffer must not connected yet", !isConnectedWith(id));
  let peerConnection = prepareNewConnection(id);
  addConnection(id, peerConnection);

  peerConnection
    .setRemoteDescription(sessionDescription)
    .then(function () {
      console.log("setRemoteDescription(offer) succsess in promise");
      makeAnswer(id);
    })
    .catch(function (err) {
      console.error("setRemoteDescription(offer) ERROR: ", err);
    });
}

function makeAnswer(id) {
  console.log("sending Answer. Creating remote session description...");
  let peerConnection = getConnection(id);
  if (!peerConnection) {
    console.error("peerConnection NOT exist!");
    return;
  }

  peerConnection
    .createAnswer()
    .then(function (sessionDescription) {
      console.log("createAnswer() succsess in promise");
      return peerConnection.setLocalDescription(sessionDescription);
    })
    .then(function () {
      console.log("setLocalDescription() succsess in promise");

      // -- Trickle ICE の場合は、初期SDPを相手に送る --
      sendSdp(id, peerConnection.localDescription);

      // -- Vanilla ICE の場合には、まだSDPは送らない --
    })
    .catch(function (err) {
      console.error(err);
    });
}

function setAnswer(id, sessionDescription) {
  let peerConnection = getConnection(id);
  if (!peerConnection) {
    console.error("peerConnection NOT exist!");
    return;
  }

  peerConnection
    .setRemoteDescription(sessionDescription)
    .then(function () {
      console.log("setRemoteDescription(answer) succsess in promise");
    })
    .catch(function (err) {
      console.error("setRemoteDescription(answer) ERROR: ", err);
    });
}

// --- tricke ICE ---
function addIceCandidate(id, candidate) {
  if (!isConnectedWith(id)) {
    console.warn(
      "NOT CONNEDTED or ALREADY CLOSED with id=" + id + ", so ignore candidate"
    );
    return;
  }

  let peerConnection = getConnection(id);
  if (peerConnection) {
    peerConnection.addIceCandidate(candidate);
  } else {
    console.error("PeerConnection not exist!");
    return;
  }
}

// start PeerConnection
function connect() {
  console.log("connect sequence start.");
  if (!isReadyToConnect()) {
    console.warn("NOT READY to connect");
  } else if (!canConnectMore()) {
    console.log("TOO MANY connections");
  } else {
    callMe();
  }
}

// close PeerConnection
function hangUp() {
  emitRoom({ type: "bye" });
  stopAllConnection();
}

// ---- multi party --
function callMe() {
  emitRoom({ type: "call me" });
}

/**
 * 画面遷移時
 */
window.onload = function () {
  setInterval(function () {
    sendBeing();
  }, 2000);

  var today = new Date();
  var hour = today.getHours();
  var minut = today.getMinutes();
  hour = ("0" + hour).slice(-2);
  minut = ("0" + minut).slice(-2);
  var textdate = hour + ":" + minut;
  var text = $("#user_name").val() + "さんが参加しました。（" + textdate + "）";

  var systemmesage =
    "ようこそ" + $("#user_name").val() + "さん。（" + textdate + "）";
  vue.addContent(systemmesage);

  setTimeout(function () {
    socket.emit("alert", text);
    socket.emit("chat", text);
    connectVideo();
  }, 5000)
};

$("#chatToggle").on("click", function () {
  $("#chatSlide").slideToggle();
});

function copyToClipboard() {
  // コピー対象をJavaScript上で変数として定義する
  var copyTarget = document.getElementById("copyTarget");

  // コピー対象のテキストを選択する
  copyTarget.select();

  // 選択しているテキストをクリップボードにコピーする
  document.execCommand("Copy");

  // コピーをお知らせする
  // alert("コピーできました！ : " + copyTarget.value);
  toastr.info("招待URLをコピーしました。");
}

// オートスクロール
var scrollY = 0;
function autoScroll() {
  var sampleBox = document.getElementById("chat-container");
  sampleBox.scrollTop = scrollY + 1;
  if (scrollY < sampleBox.scrollHeight - sampleBox.clientHeight) {
    setTimeout("autoScroll()", 20);
  } else {
    scrollY = 0;
    sampleBox.scrollTop = 0;
    setTimeout("autoScroll()", 20);
  }
}

function jumpOtherRoom(roomname) {
  const param = {
    room_name: roomname,
    user_name: $("#user_name").val(),
  };
  execPost("", param);
}

/**
 * データをPOSTする
 * @param String アクション
 * @param Object POSTデータ連想配列
 * 記述元Webページ http://fujiiyuuki.blogspot.jp/2010/09/formjspost.html
 * サンプルコード
 * <a onclick="execPost('/hoge', {'fuga':'fuga_val', 'piyo':'piyo_val'});return false;" href="#">POST送信</a>
 */
function execPost(action, data) {
  // フォームの生成
  var form = document.createElement("form");
  form.setAttribute("action", action);
  form.setAttribute("method", "post");
  form.style.display = "none";
  document.body.appendChild(form);
  // パラメタの設定
  if (data !== undefined) {
    for (var paramName in data) {
      var input = document.createElement("input");
      input.setAttribute("type", "hidden");
      input.setAttribute("name", paramName);
      input.setAttribute("value", data[paramName]);
      form.appendChild(input);
    }
  }
  // submit
  form.submit();
}

// ----------------------------------------------------------------
// ---------------------- ボタン操作 --------------------------------
// ----------------------------------------------------------------

/**
 * ビデオボタン
 */
$("#videobutton").on("click", () => {
  if (!$("#videobutton").hasClass("fab-disable")) {
    toggleVideo();
  }
});

/**
 * マイクボタン
 */
$("#micbutton").on("click", () => {
  toggleMic();
});

/**
 * 共有ボタン
 */
$("#capturebutton").on("click", () => {
  if (!$("#capturebutton").hasClass("fab-disable")) {
    toggleInput();
  }
});

/**
 * 録画ボタン 別ファイルに移動
$("#recordbutton").on("click", () => {
  alert("Now developing...");
});
 */

$("#goodbutton").on("click", () => {
  if (!$("#goodbutton").hasClass("fab-disable")) {
    sendVote("good");
    shieldButton("goodbutton");
    shieldButton("badbutton");
  }
});
$("#badbutton").on("click", () => {
  if (!$("#badbutton").hasClass("fab-disable")) {
    sendVote("bad");
    shieldButton("goodbutton");
    shieldButton("badbutton");
  }
});
$("#linkbutton").on("click", () => {
  sendLinkRequest();
});
$("#bgchangebutton").on("click", () => {
  toggleWallpaper();
});
$("#leavebutton").on("click", () => {
  leaveRoom();
});
$("#widthChangebutton").on("click", () => {
  toggleWidth();
});
$(".edgespace").on("click", () => {
  toggleWidth();
});

function toggleWidth() {
  if ($("#widthChangebutton").hasClass("widemode")) {
    $("#widthChangebutton").removeClass("widemode");
    $(".leftArea").removeClass("widemode_left");
    $(".rightArea").removeClass("widemode_right");
    $("#input_msg").removeClass("widemode_input");
    $(".edgespace").removeClass("widemode_edge");

  } else {
    setWideMode();
  }
}
function setWideMode() {
  $("#widthChangebutton").addClass("widemode");
  $(".leftArea").addClass("widemode_left");
  $(".rightArea").addClass("widemode_right");
  $("#input_msg").addClass("widemode_input");
  $(".edgespace").addClass("widemode_edge");
}


function toggleVideo() {
  localStream.getVideoTracks().forEach((track) => {
    if (track.enabled == true) {
      stopVideo();
      videoSwitchFlg = false;
      $("#videobutton").removeClass("fabon");
    } else {
      startVideo();
      videoSwitchFlg = true;
      $("#videobutton").addClass("fabon");
    }
  });
}

function toggleMic() {
  var tracks = localStream.getAudioTracks();
  if (tracks[0].enabled) {
    stopVoice();
    micSwitchFlg = false
    $("#micbutton").removeClass("fabon");
  } else {
    startVoice();
    micSwitchFlg = true
    $("#micbutton").addClass("fabon");
  }
}

/**
 * ビデオON/OFF
 */
function startVideo() {
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = true;
  });
}
function stopVideo() {
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = false;
  });
}

/**
 * マイクON/OFF
 */
function startVoice() {
  var tracks = localStream.getAudioTracks();
  tracks[0].enabled = true;
}
function stopVoice() {
  var tracks = localStream.getAudioTracks();
  tracks[0].enabled = false;
}

function toggleInput() {
  if ($("#capturebutton").hasClass("fabon")) {

    vue.resetPresenClass();
    var text = $("#user_name").val() + "さんが画面共有を終了しています。";
    socket.emit("alert", text);
    toastr.success("画面共有を終了しています。");

    stopAllConnection();

    // 画面共有モード終了のお知らせ
    clearInterval(modeIntervalControler);
    sendPresenEnd();

    $("#capturebutton").removeClass("fabon");
    setCameraVideo();
    setTimeout(() => {
      connect();
    }, 5000);
    setTimeout(() => {
      connect();
    }, 6000);
    setTimeout(() => {
      connect();
    }, 8000);

  } else {

    // 画面共有モード開始のお知らせ
    modeIntervalControler = setInterval(function () {
      sendPresenSign();
    }, 3000);

    var text = $("#user_name").val() + "さんが画面共有の準備をしています。";
    socket.emit("alert", text);

    stopAllConnection();

    setCaptureVideo()
      .then(result => {

        if (result) {
          vue.setMyPresenClass();
          setWideMode();
          $("#capturebutton").addClass("fabon");
          var text = $("#user_name").val() + "さんが画面共有をはじめました。";
          socket.emit("chat", text);
          toastr.success("画面共有を接続しています。");

          setTimeout(() => {
            connect();
          }, 2000);
          setTimeout(() => {
            connect();
          }, 3000);
          setTimeout(() => {
            connect();
          }, 4000);
          setTimeout(() => {
            connect();
          }, 5000);

        } else {
          clearInterval(modeIntervalControler);
          sendPresenEnd();
          setTimeout(() => {
            connect();
          }, 2000);
          setTimeout(() => {
            connect();
          }, 3000);
          setTimeout(() => {
            connect();
          }, 4000);
          setTimeout(() => {
            connect();
          }, 5000);
        }
      })
  }
}
function toggleInputMode(mode) {
  if (mode == "camera") {

    vue.resetPresenClass();
    var text = $("#user_name").val() + "さんが画面共有を終了しています。";
    socket.emit("alert", text);
    toastr.success("画面共有を終了しています。");

    stopAllConnection();

    // 画面共有モード終了のお知らせ
    clearInterval(modeIntervalControler);
    sendPresenEnd();

    setCameraVideo();
    setTimeout(() => {
      connect();
    }, 5000);
    setTimeout(() => {
      connect();
    }, 6000);
    setTimeout(() => {
      connect();
    }, 8000);

  } else if (mode == "capture") {

    // 画面共有モード開始のお知らせ
    modeIntervalControler = setInterval(function () {
      sendPresenSign();
    }, 3000);

    var text = $("#user_name").val() + "さんが画面共有の準備をしています。";
    socket.emit("alert", text);

    stopAllConnection();

    setCaptureVideo()
      .then(result => {

        if (result) {

          vue.setMyPresenClass();
          // setWideMode();

          var text = $("#user_name").val() + "さんが画面共有をはじめました。";
          socket.emit("chat", text);
          toastr.success("画面共有を接続しています。");

          setTimeout(() => {
            connect();
          }, 2000);
          setTimeout(() => {
            connect();
          }, 3000);
          setTimeout(() => {
            connect();
          }, 4000);
          setTimeout(() => {
            connect();
          }, 5000);

        } else {
          clearInterval(modeIntervalControler);
          sendPresenEnd();
          setTimeout(() => {
            connect();
          }, 2000);
          setTimeout(() => {
            connect();
          }, 3000);
          setTimeout(() => {
            connect();
          }, 4000);
          setTimeout(() => {
            connect();
          }, 5000);
        }
      })
  }
}

function toggleWallpaper() {

  if ($("#pageWrapper").hasClass("bg1")) {
    $("#pageWrapper").removeClass("bg1");
    $("#pageWrapper").addClass("bg2");

  } else if ($("#pageWrapper").hasClass("bg2")) {
    $("#pageWrapper").removeClass("bg2");
    $("#pageWrapper").addClass("bg3");

  } else if ($("#pageWrapper").hasClass("bg3")) {
    $("#pageWrapper").removeClass("bg3");
    $("#pageWrapper").addClass("bg4");

  } else if ($("#pageWrapper").hasClass("bg4")) {
    $("#pageWrapper").removeClass("bg4");
    $("#pageWrapper").addClass("bg5");

  } else if ($("#pageWrapper").hasClass("bg5")) {
    $("#pageWrapper").removeClass("bg5");
    $("#pageWrapper").addClass("bg6");

  } else if ($("#pageWrapper").hasClass("bg6")) {
    $("#pageWrapper").removeClass("bg6");
    $("#pageWrapper").addClass("bg7");

  } else if ($("#pageWrapper").hasClass("bg7")) {
    $("#pageWrapper").removeClass("bg7");
    $("#pageWrapper").addClass("bg8");

  } else if ($("#pageWrapper").hasClass("bg8")) {
    $("#pageWrapper").removeClass("bg8");
    $("#pageWrapper").addClass("bg9");

  } else if ($("#pageWrapper").hasClass("bg9")) {
    $("#pageWrapper").removeClass("bg9");
    $("#pageWrapper").addClass("bg1");
  }
}

function sendVote(voteStr) {
  const message = {
    vote: voteStr,
    id: socket.id,
  };
  socket.emit("vote", message);

  const mymsg = {
    vote: voteStr,
    id: "myid",
  };
  vue.vote(mymsg);

  if (voteStr === "good") {
    $("#vote_se").get(0).play();
  }
  return false;
}

function shieldButton(idname) {
  $("#" + idname).addClass("fab-disable");
  $("#" + idname)
    .delay(10000)
    .queue(function () {
      $(this).removeClass("fab-disable").dequeue();
    });
}

/**
 * 退室処理
 */
function leaveRoom() {
  Swal.fire({
    background: 'rgba(0, 0, 0, 0.8)',
    html: "<h2>退室確認</h2>" +
      "<p>この会議から退室しても宜しいでしょうか。</p>" +
      "<style>h2, p{color: #ffffff}</style>",
    showCloseButton: false,
    showCancelButton: true,
    focusConfirm: false,
    confirmButtonText: "はい",
    confirmButtonAriaLabel: "OK",
    cancelButtonText: "いいえ",
    cancelButtonAriaLabel: "No",
    reverseButtons: true,
    allowOutsideClick: true,
  }).then((result) => {
    if (result.value) {
      var text = $("#user_name").val() + "さんが退室しました。";
      socket.emit("alert", text);
      stopVideo();
      stopVoice();
      hangUp();
      toastr.info("安全に全ての接続を切りました。");
      $("#alert_se").get(0).play();
      window.setTimeout(function () {
        window.location.href = "/";
      }, 6000);
    }
  });
}

function sendLinkRequest() {
  var data = {
    room_name: $("#room_name").val(),
    password: $("#password").val(),
  };
  // socket.emit("roomhash", data);
  showLinkWindow(data);
}
function showLinkWindow(msg) {
  /*
  const root = document.location.href;
  const url = root + "?secret=" + msg;
  */
  const root = document.location.href;
  const url =
    // root + "?room_name=" + msg.room_name + "&password=" + msg.password;
    root + "?secret=" + $("#room_id").val()
  Swal.fire({
    background: 'rgba(0, 0, 0, 0.8)',
    html:
      `<h2>招待URL</h2>` +
      `<p>下記URLを招待する対象者へお知らせください。</p>` +
      `<input class="linkinputtext" value="` +
      url +
      `"/>` +
      "<style>h2, p{color: #ffffff}</style>",
    focusConfirm: false,
    confirmButtonText: "閉じる",
    confirmButtonAriaLabel: "Close",
    allowOutsideClick: true,
  });
}

$("#testbutton1").on("click", () => {
  stopAllConnection();
});

$("#testbutton2").on("click", () => {
  connect();
});

function sendRefreshRequest() {
  socket.emit("refresh");
}

function showUpdateWindow() {
  Swal.fire({
    title: "画面共有を開始します。",
    showCancelButton: false,
    allowOutsideClick: false,
  }).then((result) => {
    stopAllConnection();
    setTimeout(() => {
      connect();
    }, 2000);
    setTimeout(() => {
      connect();
    }, 3000);
    setTimeout(() => {
      connect();
    }, 5000);
    setTimeout(() => {
      connect();
    }, 8000);
  });
}

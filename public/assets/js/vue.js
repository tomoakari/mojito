

/**
 * *************************************************************************
 * ルームメンバーを管理するVue
 */
const app = Vue.createApp({

  data() {
    return {
      isShowMenuArea: true,
      isShowMembarArea: true,
      isShowMenuList: false,
      isShowChatArea: false,
      isMuteAllVideo: false,
      isVoted: false,
      isPushRaise: false,
      isPushGood: false,
      isPushBad: false,
      isScreenRec: false,
      isScreenShare: false,
      isAudienceMode: false,
      isPresenterMode: false,
      isShowBadge: false,
      voteAreaWitdh: "200px",
      voteAreaRight: "20px",
      roomid: "",
      members: [
        /*
        {
          user_id: "uid",
          user_name: "name1",
          timestamp: "1111111111"
        }
        */
      ],
      contents: [
        {
          // id: 1,
          // text: "ルームに参加しました。左下のカメラボタンでスタートしてください。"
        },
      ],
      vCount: 1,
      voteStyle: {
        width: this.voteAreaWitdh,
        right: this.voteAreaRight
      },
    }
  },
  computed: {
    isMobileMode: function () {
      var width = document.body.clientWidth;
      if (width < 480) {
        return true;
      }
      return false;
    },
    loginmembers: function () {
      var viewList = [];

      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);

      for (var i in this.members) {
        var member = this.members[i];

        if (Number(member.timestamp) > nowtime - 10) {
          viewList.push(member);
        }
      }
      return viewList;
    },
  },
  mounted() {
    this.setPCView();
  },
  methods: {
    setPCView: function () {
      if (this.isMobileMode) {
        this.isShowMenuArea = false;
        this.isShowMembarArea = false;

        var vw = document.getElementsByClassName('rightArea')[0].clientWidth;
        this.voteAreaWitdh = vw + "px";
        var vr = (vw - 179) / 2;
        this.voteAreaRight = vr + "px";
      }
    },
    // ボタン操作
    togglePCChatArea: function () {
      // バッジをOFF
      this.isShowBadge = false;
      if (this.isShowMenuList || this.isShowMembarArea) {
        this.isShowMenuList = false;
        this.isShowChatArea = true;
        this.isShowMembarArea = false;
        return;
      }
      this.isShowMenuArea = !this.isShowMenuArea;
      this.isShowChatArea = !this.isShowChatArea;
      this.isShowMenuList = false;
      this.isShowMembarArea = false;
    },
    togglePCMembarArea: function () {
      if (this.isShowMenuList || this.isShowChatArea) {
        this.isShowMenuList = false;
        this.isShowChatArea = false;
        this.isShowMembarArea = true;
        return;
      }
      this.isShowMenuArea = !this.isShowMenuArea;
      this.isShowMembarArea = !this.isShowMembarArea;
      this.isShowMenuList = false;
      this.isShowChatArea = false;
    },
    togglePCMenuArea: function () {
      if (this.isShowMembarArea || this.isShowChatArea) {
        this.isShowMenuList = true;
        this.isShowChatArea = false;
        this.isShowMembarArea = false;
        return;
      }
      this.isShowMenuArea = !this.isShowMenuArea;
      this.isShowMenuList = !this.isShowMenuList;
      this.isShowMembarArea = false;
      this.isShowChatArea = false;
    },
    toggleMenuArea: function () {
      this.isShowMenuArea = !this.isShowMenuArea;
      if (this.isShowMenuArea) {
        this.isShowMembarArea = true;
      } else {
        this.isShowMenuList = false;
        this.isShowChatArea = false;
        this.isShowMembarArea = false;
      }
    },
    toggleChatArea: function () {
      // バッジをOFF
      this.isShowBadge = false;
      this.isShowChatArea = !this.isShowChatArea;
      this.isShowMenuList = false;
      if (!this.isShowChatArea) {
        this.isShowMenuArea = false;
      }
    },
    toggleMembarArea: function () {
      this.isShowMembarArea = !this.isShowMembarArea;
      this.isShowMenuList = false;
      if (!this.isShowMembarArea) {
        this.isShowMenuArea = false;
      }
    },
    toggleScreenShare: function () {
      if (this.isAudienceMode) {
        toastr.success("画面共有中のため、カメラ機能を制限しています。");
        return;
      }
      this.isScreenShare = !this.isScreenShare;
      if (this.isScreenShare) {
        toggleInputMode("capture");
      } else {
        toggleInputMode("camera");
      }
    },
    showLinkWindow: function () {
      this.roomid = document.getElementById("room_id").value;
      const root = document.location.href;
      const url =
        root + "?secret=" + this.roomid;
      Swal.fire({
        background: 'rgba(0, 0, 0, 0.8)',
        html:
          `<p><img src="assets/images/invite.svg" class="bigsvgicon">対象者へURLをお知らせください。</p>` +
          `<input id="copyTarget" class="linkinputtext" value="` +
          url +
          `"/>` +
          `<style>h2, p{color: #ffffff; font-size: 14px;}</style>`,
        focusConfirm: false,
        confirmButtonText: "コピー",
        confirmButtonAriaLabel: "Close",
        allowOutsideClick: true,
      }).then((result) => {
        if (result.value) {
          copyToClipboard();
        }
      });
    },

    sendVote: function (voteparam) {
      var voteStr = voteparam;
      // TODO: 挙手はON/OFFのスイッチボタンで
      if (voteStr === "raise") {
        if (this.isPushRaise) {
          voteStr = "down";
        }
      } else {
        //if (this.isVoted) {
        //  return;
        // }
      }
      const message = {
        vote: voteStr,
        id: socket.id,
      };
      socket.emit("vote", message);

      const mymsg = {
        vote: voteStr,
        id: "myid",
      };
      this.vote(mymsg);


      if (voteStr === "raise") {
        this.isPushRaise = true;
        this.isPushGood = false;
        this.isPushBad = false;
      }
      else if (voteStr === "down") {
        this.isPushRaise = false;
      }
      else if (voteStr === "good") {
        $("#yes_se").get(0).play();
        this.isPushGood = true;
        this.isPushBad = false;
        this.isPushRaise = false;
        window.setTimeout(() => {
          this.isPushGood = false;
        }, 10000);
      }
      else if (voteStr === "bad") {
        $("#no_se").get(0).play();
        this.isPushBad = true;
        this.isPushGood = false;
        this.isPushRaise = false;
        window.setTimeout(() => {
          this.isPushBad = false;
        }, 10000);
      }

      /*
      this.isVoted = true;
      window.setTimeout(() => {
        this.isVoted = false;
      }, 15000);
      */

    },
    leaveRoom: function () {
      Swal.fire({
        background: 'rgba(0, 0, 0, 0.8)',
        html:
          "<p><img src='assets/images/door2.svg' class='bigsvgicon'>この会議から退室しますか？</p>" +
          "<style>h2, p{color: #ffffff; font-size: 14px;}</style>",
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
          // $("#alert_se").get(0).play();
          window.setTimeout(function () {
            window.location.href = "https://kaigishitsu.aice.cloud/home";
          }, 6000);
        }
      })
    },
    toggleRecScreen: function () {
      this.isScreenRec = !this.isScreenRec;
      if (this.isScreenRec) {
        startScreenRec();
      } else {
        stopScreenRec();
      }
    },
    updateMemberList: function (msg) {
      var text = msg;
      const words = text.split("---");
      const user_name = words[0];
      const user_id = words[1];

      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);
      var exist_count = 0;

      // 一致するものがあったらtimestampを更新
      this.members.forEach((member, index) => {
        if (member.user_id === user_id) {
          this.members[index].timestamp = nowtime;
          exist_count++;
        }
      });

      // 新規メンバーならmemberに追加
      if (exist_count == 0) {
        const new_member = {
          user_id: user_id,
          user_name: user_name,
          timestamp: nowtime,
        };
        this.members.push(new_member);
      }
    },

    unsableUser: function (msg) {
      var text = msg;
      const words = text.split("---");
      const user_name = words[0];
      const user_id = words[1];

      // 一致するものがあったらtimestampを0にする
      this.members.forEach((member, index) => {
        if (member.user_id === user_id) {
          this.members[index].timestamp = 0;
          exist_count++;
        }
      });
    },

    vote: function (data) {
      var id = data.id;

      if (data.vote === "raise") {
        toastr.info("参加者の挙手がありました。");
        $("#raise_se").get(0).play();
        //$("#user_blank_" + id).addClass("hidden");
        $("#user_good_" + id).addClass("hidden");
        $("#user_bad_" + id).addClass("hidden");
        $("#user_raise_" + id).removeClass("hidden");

      } else if (data.vote === "down") {
        //$("#user_blank_" + id).removeClass("hidden");
        $("#user_raise_" + id).addClass("hidden");

      } else if (data.vote === "good") {
        //$("#vote_se").get(0).play();
        //$("#user_blank_" + id).addClass("hidden");
        $("#user_raise_" + id).addClass("hidden");
        $("#user_bad_" + id).addClass("hidden");
        $("#user_good_" + id).removeClass("hidden");
        window.setTimeout(function () {
          //$("#user_blank_" + id).removeClass("hidden");
          $("#user_good_" + id).addClass("hidden");
        }, 10000);

      } else if (data.vote === "bad") {
        //$("#vote_se").get(0).play();
        //$("#user_blank_" + id).addClass("hidden");
        $("#user_raise_" + id).addClass("hidden");
        $("#user_good_" + id).addClass("hidden");
        $("#user_bad_" + id).removeClass("hidden");
        window.setTimeout(function () {
          //$("#user_blank_" + id).removeClass("hidden");
          $("#user_bad_" + id).addClass("hidden");
        }, 10000);
      }

    },
    // チャットメッセージを受信したら呼ばれる
    addContent: function (msg) {
      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);
      var newMessage = {
        id: nowtime,
        text: msg,
      };
      this.contents.push(newMessage);

      this.setBadge()
      // this.scrollBottom();

      var $this = this;
      Vue.nextTick(function () {
        $this.scrollToEnd();
      });
    },
    scrollToEnd: function () {
      var container = document.getElementById("chatscrollarea");
      container.scrollTop = container.scrollHeight;
    },
    // 表示されているビデオ数を管理
    addVideoCount: function () {
      this.vCount++;
    },
    removeVideoCount: function () {
      this.vCount--;
    },
    toggleMuteAllVideo() {
      this.isMuteAllVideo = !this.isMuteAllVideo;
      var vrate = 1.0
      if (this.isMuteAllVideo) {
        vrate = 0.0
      }
      $(".membersvideo").each((index, elm) => {
        if (elm.id !== "local_video") {
          elm.volume = vrate;
        }
      });
    },
    setBadge: function () {
      if (!this.isShowChatArea) {
        this.isShowBadge = true;
      }
    },
    /*
    setMyPresenClass() {
      $("#container").addClass("audienceContainer")
      const targetId = "#video_container_local_video";
  
      $(targetId).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7 vcAudience");
      $(targetId).addClass("vcPresen");
  
      $(".videowrapper").each((index, elm) => {
        $(elm).addClass("vcAudience");
        $(elm).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7");
      });
    },
    setPresenClass(fromid) {
      if (!$("#container").hasClass("audienceContainer")) {
        $("#container").addClass("audienceContainer")
      }
      const targetId = "#video_container_" + fromid;
      console.log("setPresenClass..." + targetId);
      if (!$(targetId).hasClass("vcPresen")) {
        $(targetId).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7 vcAudience");
        $(targetId).addClass("vcPresen");
      }
      $(".videowrapper").each((index, elm) => {
        if (!$(elm).hasClass("vcPresen")) {
          $(elm).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7");
          $(elm).addClass("vcAudience");
        }
      });
    },
    resetPresenClass() {
      if ($("#container").hasClass("audienceContainer")) {
        $("#container").removeClass("audienceContainer")
      }
      $(".videowrapper").each((index, elm) => {
        $(elm).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7 vcPresen vcAudience");
        $(elm).addClass(this.getClassname);
      });
    },
    setPresenClass(fromid) {
      if (!$("#container").hasClass("audienceContainer")) {
        $("#container").addClass("audienceContainer")
      }
      const targetId = "#video_container_" + fromid;
      console.log("setPresenClass..." + targetId);
      if (!$(targetId).hasClass("vcPresen")) {
        $(targetId).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7 vcAudience");
        $(targetId).addClass("vcPresen");
      }
      $(".videowrapper").each((index, elm) => {
        if (!$(elm).hasClass("vcPresen")) {
          $(elm).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7");
          $(elm).addClass("vcAudience");
        }
      });
    },
    */
    setMyPresenClass() {
      //$("#container").addClass("audienceContainer")

      $(".videowrapper").each((index, elm) => {
        $(elm).addClass("vcAudience");
        $(elm).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7");
      });

      const targetId = "#video_container_local_video";
      $(targetId).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7 vcAudience");
      $(targetId).addClass("vcPresen");
    },

    setPresenClass(fromid) {
      //if (!$("#container").hasClass("audienceContainer")) {
      //  $("#container").addClass("audienceContainer")
      //}
      const targetId = "#video_container_" + fromid;
      console.log("setPresenClass..." + targetId);
      if (!$(targetId).hasClass("vcPresen")) {
        $(targetId).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7 vcAudience");
        $(targetId).addClass("vcPresen");
      }
      $(".videowrapper").each((index, elm) => {
        if (!$(elm).hasClass("vcPresen")) {
          $(elm).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7");
          $(elm).addClass("vcAudience");
        }
      });
    },
    resetPresenClass() {
      //if ($("#container").hasClass("audienceContainer")) {
      //  $("#container").removeClass("audienceContainer")
      //}
      $(".videowrapper").each((index, elm) => {
        $(elm).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7 vcPresen vcAudience");
        $(elm).addClass(this.getClassname);
      });
    },

    editVideoClass: function () {
      const isPresenter = $("#video_container_local_video").hasClass("vcPresen");
      const isAudience = $("#video_container_local_video").hasClass("vcAudience");
      if (isPresenter) {
        const targetId = "#video_container_local_video";
        $(targetId).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7 vcAudience");
        $(targetId).addClass("vcPresen");

        $(".videowrapper").each((index, elm) => {
          $(elm).addClass("vcAudience");
          $(elm).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7");
        });
        return
      }
      if (isAudience) {
        return
      }
      $(".videowrapper").each((index, elm) => {
        $(elm).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7 vcPresen vcAudience");
        $(elm).addClass(this.getClassname);
      });
    },

    getClassname: function () {
      var classname = "";
      switch (this.vCount) {
        case 1:
          classname = "vc1";
          break;
        case 2:
          classname = "vc2";
          break;
        case 3:
          classname = "vc3";
          break;
        case 4:
          classname = "vc4";
          break;
        case 5:
          classname = "vc5";
          break;
        case 6:
          classname = "vc6";
          break;
        default:
          // 7以上は同じ
          classname = "vc7";
          break;
      }
      return classname;
    },
  },
});

const vue = app.mount('#pageWrapper')




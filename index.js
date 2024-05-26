// SSL版・エクスプレスサーバ・ソケットサーバの基本設定
// SSL準備
let fs = require("fs");

let port = 8450;
let ssl_server_key = "/etc/letsencrypt/live/mojito.aice.cloud/privkey.pem";
let ssl_server_crt = "/etc/letsencrypt/live/mojito.aice.cloud/fullchain.pem";

let options = {
    key: fs.readFileSync(ssl_server_key),
    cert: fs.readFileSync(ssl_server_crt),
};
let express = require("express");
let app = express();
let server = require("https").createServer(options, app);

const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    }
});

// cors対応
const cors = require('cors')
app.use(cors())


// テンプレートエンジン
app.set("view engine", "ejs");

app.set("views", __dirname + "/views");
app.set("public", __dirname + "/public");

// POSTにも対応
let bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ハッシュライブラリ
const crypto = require("crypto");

/**
 * ****************************************************
 * ルーティング
 * ****************************************************
 */

/**
 * 会議室ページ
 */
app.get("/", async (request, response) => {
// app.post("/", async (request, response) => {
    // response.sendFile(__dirname + "room.html");
    response.sendFile(__dirname + "/public/views/room.html");
});

/**
 * 会議室ページ
 */
app.get("/lobby", async (request, response) => {
    if(request.query.name == null || request.query.no == null || request.query.unm == null ){
        return { message: "認証失敗しました"}
    }

    data = {
        user_id: request.query.no,
        user_name: request.query.name,
        nick_name: request.query.unm,
        room_name: "lobby",
    };
    response.render(__dirname + "/public/views/index_renew_invited.ejs", data);
    });


// ファイル置き場
app.use(express.static(__dirname + "/public"));

// リッスン開始
server.listen(port, function () {
    console.log("Server listening at port %d", port);
});


/**
 * ****************************************************
 * ソケットの設定
 * ****************************************************
 */
io.on("connection", function (socket) {
    // ---- multi room ----
    socket.on("enter", function (roomname) {
        socket.join(roomname);
        console.log("ENTER ROOM... id=" + socket.id + " enter room=" + roomname);
        setRoomname(roomname);
    });

    function setRoomname(room) {
        socket.roomname = room;
    }

    function getRoomname() {
        let room = socket.roomname;
        return room;
    }

    function emitMessage(type, message) {
        // ----- multi room ----
        let roomname = getRoomname();

        if (roomname) {
            console.log('===== message broadcast to room -->' + roomname);
            socket.broadcast.to(roomname).emit(type, message);
        } else {
            console.log("===== message broadcast all");
            socket.broadcast.emit(type, message);
        }
    }

    // When a user send a SDP message
    // broadcast to all users in the room
    socket.on("message", function (message) {
        let date = new Date();
        message.from = socket.id;
        //console.log(date + 'id=' + socket.id + ' Received Message: ' + JSON.stringify(message));

        // get send target
        let target = message.sendto;
        if (target) {
            //console.log('===== message emit to -->' + target);
            socket.to(target).emit("message", message);
            return;
        }

        // broadcast in room
        emitMessage("message", message);
    });

    // When the user hangs up
    // broadcast bye signal to all users in the room
    socket.on("disconnect", function () {
        // close user connection
        console.log(new Date() + " Peer disconnected. id=" + socket.id);

        // --- emit ----
        emitMessage("user disconnected", { id: socket.id });

        // --- leave room --
        let roomname = getRoomname();
        if (roomname) {
            socket.leave(roomname);
        }
    });

    // チャットメッセージの配信
    socket.on("chat", function (message) {
        console.log(" chat send. socket.id= " + socket.id + "message= " + message);
        message.from = socket.id;

        // broadcast in room
        emitMessage("chat", message);
    });

    // ログインメッセージの配信
    socket.on("alert", function (message) {
        message.from = socket.id;

        // broadcast in room
        emitMessage("alert", message);
    });

    // PINGの配信
    socket.on("being", function (message) {
        //message.from = socket.id;
        console.log("being received. " + message);
        emitMessage("being", message);
    });

    // 画面共有モードの配信
    socket.on("presen", function (message) {
        message.from = socket.id;
        emitMessage("presen", message);
    });
    socket.on("presenEnd", function (message) {
        emitMessage("presenEnd", message);
    });

    // マイク使用シグナルの配信
    socket.on("talkSignal", function (message) {
        emitMessage("talkSignal", message);
    });
    // マイクリリースシグナルの配信
    socket.on("releaseSignal", function (message) {
        emitMessage("releaseSignal", message);
    });

    // 退出シグナルの配信
    socket.on("leaveSignal", function (message) {
        emitMessage("leaveSignal", message);
    });

    // 投票シグナルの配信
    socket.on("vote", function (message) {
        emitMessage("vote", message);
    });
    // リンクパラメータの配信
    socket.on("roomhash", function (message) {
        let data = {
            room_name: message.room_name,
            password: message.password,
        };
        // const result = executeEncrypt(JSON.stringify(data));
        socket.emit("roomhash", data);
    });
});



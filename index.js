//expressモジュールを使えるように設定
const express = require('express')
//expressモジュールを利用しアプリケーションオブジェクトappを作成
const app = express()

// HTTPgetメソッドでアクセスしたら、'Hello World!'と表示される設定。
app.get('/', (req, res) => {
  res.send('Hello World!')
})

//サーバーを起動したら、リクエストを8000番ポートで待ち受ける設定。
app.listen(8000, () => console.log('Example app listening on port 8000!'))

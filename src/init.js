if (process.env.NODE_ENV === undefined) {
    require("dotenv").config()
}
const app = require('/Users/puranjaymishra/Documents/petavue/info-agent/src/app.js')
const mongoDB = require("/Users/puranjaymishra/Documents/petavue/info-agent/src/mongo.js")

const port = 3000;

app.on("ready", () =>{
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});
(async function () {
const mongo = new mongoDB()
await mongo.connect()
app.emit("ready")
})()



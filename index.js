import express from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { ObjectId } from "bson";
import bcrypt from "bcrypt";
import cors from "cors";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";


dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());
const PORT = process.env.PORT || 9000;

app.listen(PORT, () => console.log("listening to", PORT));

const MONGO_URL = process.env.MONGO_URL;

async function createConnection() {
  try {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log("connected");
    return client;
  } catch (err) {
    console.log(err);
  }
}
createConnection();
app.get("/",async(req,res)=>{
  res.send("Welcome to password reset flow app");
})
app.post("/signup", async (req, res) => {
  console.log(req.body);

  const { username, password } = req.body;
  console.log(password);
  const hpassword = await genPassword(password);

  const client = await createConnection();
  console.log(hpassword);
  const user = await client
  .db("Password")
  .collection("PassDB")
    .findOne({ username: username });
  if (user) res.status(405).send({ message: "You already exist with us" });
  else {
    // const act_token = Activate({ username });
    // if (act_token) {
      await client
      .db("Password")
      .collection("PassDB")
        .insertOne({ username: username, password: hpassword });
      res.status(205).send({ message: "Account added" });
      console.log("here");
    // }
  }
});


app.post("/login", async (req, res) => {
    console.log(req.body);
    const { username, password } = req.body;
    const client = await createConnection();
    const user = await client
      .db("Password")
      .collection("PassDB")
      .findOne({ username: username });
      console.log(user);
    const pass = await bcrypt.compare(password, user.password);
    console.log(pass);
    if (pass && user.temp === "yes") {
      const token = jwt.sign(
        { username: user.username },
        process.env.temp_token + user.username
      );
      res.send({ message: "success", token: token, temp:"yes" });
    }else if(pass){
        const token = jwt.sign(
            { username: user.username },
            process.env.token + user.username
          );
          res.send({ message: "success", token: token, temp:"no" });
    } else res.status(401).send({ message: "error" });
  });

  app.post("/forgot",async (request, response) => {
    console.log(request.body);
    const { username } = request.body;
    const userName = await Forgot({username});
    if (userName){
      console.log(userName);
      response.send({message:"Signed up",token:userName});
  }
    else response.status(401).send({message:"invalid credentials"});
  });

async function Forgot({username}){
  const client = await createConnection();
    const user=await client.db("Password").collection("PassDB").findOne({username:username});
    if(user){
        const temporary=tempPass();
        console.log(temporary);
        const password_temp=await genPassword(temporary);
        await client.db("Password").collection("PassDB").updateOne({username:username},{$set:{temp:"yes",password:password_temp}});  
        
      const token = jwt.sign({ id: user._id }, user.username);
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.user,
          pass: process.env.pass
        }
      })
      
      const mailOptions = {
        from: 'testing.00k@gmail.com',
        to: `${username}`,
        subject: `Temporary password`,
        text: "Your temporary password is "+`${temporary}`,
        replyTo: `test`
      }
      transporter.sendMail(mailOptions, function(err, res) {
        if (err) {
          console.error('there was an error: ', err);
        } else {
          console.log('here is the res: ', res)
        }
      })
      return token;
    }
    
    else return null;
  }

  app.post("/forgot/reset",async (request, response) => {
    const { email,password,token } = request.body;
    const userReset = await Reset({email,password,token});
    if (userReset==="found"){
      console.log(userReset);
      response.send({message:"Password changed successfully"});
  }
    else if(userReset==="not found") response.status(401).send({message:"invalid credentials,check the email-id provided or contact the administrator"});
    else if(userReset==="wrong token") response.status(402).send({message:"Try changing your own password buddy!!😒"})
  });

   async function Reset({ email,password,token }) {
    const User = await client
      .db("Password")
      .collection("PassDB")
      .findOne({ username: email });
    if(User){
      try{
      const pass=jwt.verify(token,email);
      }catch{return "wrong token"}
      {
        const hpassword = await genPassword(password);
        const userReset = await client
        .db("Password")
        .collection("PassDB")
        .updateOne(
          { _id: ObjectId(User._id) },
          {
            $set: {
              password:hpassword,
            },
          }
        );
        return ("found");
      }
    }else return ("not found");
  }

  function tempPass() {
    var text = "";
    var possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  
    for (var i = 0; i < 6; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return text;
  }
  
 async function genPassword(password) {
    const salt = await bcrypt.genSalt(10);
    const hashedpassword = await bcrypt.hash(password, salt);
    return hashedpassword;
  }
  
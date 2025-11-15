
const express = require('express');
const app = express();
//mongodb cluster connect
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');  
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

// firebase token verified
// const { initializeApp } = require('firebase-admin/app'n
// );
const admin = require("firebase-admin");

// index.js
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// create middleware 
app.use(cors());
app.use(express.json())

//middleware for verified access toke of firebase
const verifyFireBaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
      return res.status(401).send({ message:'unauthorized access' })
  }
  const token = authorization.split(' ')[1];
  
  try {
      const decoded = await admin.auth().verifyIdToken(token);
      console.log('inside token', decoded)
      req.token_email = decoded.email;
      next();
  }
  catch (error) {
      return res.status(401).send({ message: 'unauthorized access' })
  }
}

//mongodb cluster connect
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vcvzka8.mongodb.net/?appName=Cluster0`;

//mongodb client

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


app.get('/', (req, res) => {
  res.send('Hello PlateShare!')
})


//function for mongodatabase connect
async function run (){

  try{
    // await client.connect();

    //create database folder
    const db = client.db('plateshare_db');

    const foodsCollection =db.collection('foods');
    const myfoodsCollection = db.collection('myfoods');
    const userCollection = db.collection('users');
    const requestedCollection = db.collection('requestedFoods');

    //Users api
    app.post('/users', async(req,res)=>{
      const newUser= req.body;
      const email = req.body.email;
      const query = {email:email}
      const existingUser = await userCollection.findOne(query);

      if(existingUser){
        res.send({message: 'user already exits.'})
      }else{
        const result = await userCollection.insertOne(newUser);
      }
    })



    //getting foods for myFoods list

    app.get('/myfoods',verifyFireBaseToken, async(req,res)=>{
      const email = req.query.email;
      
      const query = { contributor_email: email };
        if(email !== req.token_email){
          return res.status(403).send({message: 'forbidden access'})
      }
     
      const cursor = 
      foodsCollection.find(query).sort({created_at: -1});
      const result = await cursor.toArray();

      res.send(result);

    });

    //getting foods by id
    app.get('/foods/:id', async(req,res)=>{
      const id = req.params.id;
      const query ={
        _id:new ObjectId(id)
      };

      const result = await 
       foodsCollection.findOne(query);
      res.send(result);

    })

    //get all foods

     app.get('/allfoods', async(req,res)=>{
      const cursor = 
      foodsCollection.find().sort({quantity: -1});
   
      const result = await cursor.toArray();
      res.send(result);

    })

    //get featured food

    app.get('/featuredFoods', async(req,res)=>{
      const cursor = foodsCollection.find().sort({quantity: -1}).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    })

    //get requested food
    app.get('/myreqfoods',verifyFireBaseToken, async(req,res)=>{
      const email = req.query.email;
      const query = {requestor_email: email };
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
    
        if(email !== req.token_email){
          return res.status(403).send({message: 'forbidden access'})
      }
     
      const cursor = 
      requestedCollection.find(query);
      const result = await cursor.toArray();

      res.send(result);

    });

    //addfoods

    app.post('/addfoods',verifyFireBaseToken, async(req,res)=>{

      const newFoods= req.body;
      console.log('recieve food:', newFoods)

      const result = await 
      foodsCollection.insertOne(newFoods);

      res.send(result);
    })


    //added requested post

    app.post('/requestFood',verifyFireBaseToken, async(req,res)=>{

      const requestData = req.body;
      const foodId = requestData.foodId;
      const requesterEmail = requestData.requestor_email;
      const query = {_id: new ObjectId(foodId)};

      const food = await foodsCollection.findOne(query)
     
      if(!food){
        return res.status(404).send({ message: "Food not found" });
      }
      if (food.contributor_email === requestData.requestor_email) {
        return res.status(400).json({
          message: "You cannot request a food that you posted."
        });
      }
      
      if(food.quantity<=0){
        return res.status(400).send({ message: "This food is no longer available" });
      }

      const existingRequest = await requestedCollection.findOne({
        foodId: foodId,
        requestor_email: requesterEmail
      });
    
      if (existingRequest) {
        return res.status(400).json({
          message: "You already requested this food."
        });
      }
      

      const result = await 
      requestedCollection.insertOne(requestData);

      res.send(result);
    })



    //updating foods
    app.patch('/myfoods/:id', async(req,res)=>{

      const id = req.params.id;
      const query ={_id: new ObjectId(id)};
      const updatedFood = req.body;
      

      // update data 
      const update ={
        $set:{
          name: updatedFood.name,
          quantity: updatedFood.quantity,
        }


      }

      const result = await foodsCollection.updateOne(query,update)

      res.send(result);

    })


    //my myreqfoods delete
    app.delete('/myreqfoods/:id', async(req,res)=>{

      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const food = await requestedCollection.findOne(query);

      if(!food){
        return res.status(404).send({ message: 'Food not found' });

      }
  
      const result = await requestedCollection.deleteOne(query);
      res.send(result);
    })
     
    //delete one
    app.delete('/myfoods/:id', async(req,res)=>{

      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const food = await foodsCollection.findOne(query);

      if(!food){
        return res.status(404).send({ message: 'Food not found' });

      }
      // if(food.contributor_email !== req.token_email){
      //   return res.status(403).send({ message: 'Forbidden: You cannot delete this item' });
      // }
      const result = await foodsCollection.deleteOne(query);
      res.send(result);
    })


    // await client.db("admin").command({ping:1});
    // console.log("pinged successfull");
  }

finally{

}


}

//function call

run().catch(console.dir)

//finish mongodb function 



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

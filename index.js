const express = require('express')
const app = express()
const port = process.env.PORT || 5000;
require('dotenv').config();
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json());

/* mongodb functionality start */
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@ic-cluster.qdhi4wp.mongodb.net/?appName=ic-cluster`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    /* collection connect start */
    const db = client.db("ping_up");
    const userCollections = db.collection("user");
    /* collection connect end */

    /* user's APIs start */
    app.post("/user", async(req, res) => {
        const user = req.body;
        const email = req.body.email;
        const query = {email: email};
        const existingUser = await userCollections.findOne(query);

        if(existingUser) {
            return res.send({message: "User already exists"});
        } else {
            const result = await userCollections.insertOne(user);
            res.send(result);
        }
    });
    /* user's APIs end */


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
/* mongodb functionality end */

app.get('/', (req, res) => {
  res.send('Hello NetWork')
})

app.listen(port, () => {
  console.log(`server is running on port http://localhost:${port}`)
})

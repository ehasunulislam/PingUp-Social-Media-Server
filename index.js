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
    const storyCollections = db.collection("stories");
    /* collection connect end */

    /* story collection start */
    // ==================== GET: For taking all the Stories ====================
    app.get("/all-stories", async(req, res) => {
      try{
        const story = await storyCollections.find().sort({createdAt: -1 }).toArray();
        res.send(story);
      }
      catch(err) {
        res.status(500).send({message: "Failed to fetch stories", error: err.message});
      }
    })

    // ==================== POST: Create a new story ====================
    app.post("/stories/upload", async(req, res) => {
      const {email, dayPic} = req.body;
      if(!email || !dayPic) {
        return res.status(400).send({message: "Email and dayPic are required"});
      }

      // find the user 
      const user = await userCollections.findOne({email: email});
      if(!user) {
        return res.status(404).send({message: "User not found"});
      }

      // create a new story
      const newStory = {
        userId : user._id,
        userName: user.name,
        userEmail: user.email,
        userImg: user.img,
        dayPic: dayPic, 
        createdAt: new Date(),
      }

      const result = await storyCollections.insertOne(newStory);
      res.send(result);
    });
    /* story collection end */   


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

    // get api's for all user 
    app.get("users", async(req, res) => {
      const cursur = document.getElementById("server");
      increment ++
    })
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

const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

// middleware import from own folders
const upload = require("./middlewares/multer");
const cloudinary = require("./config/cloudinary");

/* mongodb functionality start */
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@ic-cluster.qdhi4wp.mongodb.net/?appName=ic-cluster`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    /* collection connect start */
    const db = client.db("ping_up");
    const userCollections = db.collection("user");
    const storyCollections = db.collection("stories");
    const createPostCollections = db.collection("create-post");
    /* collection connect end */

    /* story API's start */
    //  GET: For taking all the Stories
    app.get("/all-stories", async (req, res) => {
      try {
        const story = await storyCollections
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(story);
      } catch (err) {
        res
          .status(500)
          .send({ message: "Failed to fetch stories", error: err.message });
      }
    });

    //  POST: Create a new story with Image
    app.post("/stories/upload", async (req, res) => {
      const { email, dayPic } = req.body;
      if (!email || !dayPic) {
        return res
          .status(400)
          .send({ message: "Email and dayPic are required" });
      }

      // find the user
      const user = await userCollections.findOne({ email: email });
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      // create a new story
      const newStory = {
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userImg: user.img,
        dayPic: dayPic,
        createdAt: new Date(),
      };

      const result = await storyCollections.insertOne(newStory);
      res.send(result);
    });
    /* story API's end */

    /* user's APIs start */
    app.post("/user", async (req, res) => {
      const user = req.body;
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await userCollections.findOne(query);

      if (existingUser) {
        return res.send({ message: "User already exists" });
      } else {
        const result = await userCollections.insertOne(user);
        res.send(result);
      }
    });
    /* user's APIs end */

    /* create-post API's start */
    app.post("/create-post", upload.array("images"), async (req, res) => {
      try {
        const { text, email } = req.body;

        // if post is empty
        if (!text && (!req.files || req.files.length === 0)) {
          return res.status(400).send({ message: "Post cannot be empty" });
        }

        // find user
        const user = await userCollections.findOne({ email });
        if (!user) {
          return res.status(400).send({ message: "user not found" });
        }

        let imageUrls = [];

        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            const base64 = file.buffer.toString("base64");

            const result = await cloudinary.uploader.upload(
              `data:${file.mimetype};base64,${base64}`,
              {
                folder: "create-post",
              }
            );

            imageUrls.push(result.secure_url);
          }
        }

        // post object
        const newPost = {
          text: text || "",
          img: imageUrls,

          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          userImg: user.img,

          createdAt: new Date(),
        };

        const result = await createPostCollections.insertOne(newPost);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to create post" });
      }
    });
    /* create-post API's end */

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
/* mongodb functionality end */

app.get("/", (req, res) => {
  res.send("Hello NetWork");
});

app.listen(port, () => {
  console.log(`server is running on port http://localhost:${port}`);
});

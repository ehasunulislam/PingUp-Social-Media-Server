const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
    const FeedsLovesCollections = db.collection("feeds-love");
    const FeedsCommentsCollections = db.collection("feeds-comments");
    const FriendRequestCollections = db.collection("friends_request");
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
    // ------------- GET: for Single user information with ID -------------
    app.get("/user/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { uid: id };

        const result = await userCollections.findOne(query);

        if (!result) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // ------------- GET: for all-user information -------------
    app.get("/all-user", async (req, res) => {
      try {
        const search = req.query.search || "";
        let query = {};

        if (search) {
          query = {
            $or: [{ name: { $regex: search, $options: "i" } }],
          };
        }

        const cursor = userCollections.find(query).sort({ createdAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // ------------- POST: for user create -------------
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

    // ------------- PATCH: for user update -------------
    app.patch("/update-user", async (req, res) => {
      try {
        const { email, ...editedData } = req.body;

        if (!email) {
          return res.status(400).send({ message: "Email required" });
        }

        const result = await userCollections.updateOne(
          { email: email },
          {
            $set: {
              ...editedData,
              updateDate: new Date(),
            },
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({ success: true, result });
      } catch (err) {
        res.status(500).send({ message: "Internal Server Error" });
      }
    });
    /* user's APIs end */

    /* create-post API's start */
    // ------------- GET: for all-post(with user's uid) -------------
    app.get("/getAll-posts/:id", async (req, res) => {
      try {
        const uid = req.params.id;

        const user = await userCollections.findOne({ uid });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        const posts = await createPostCollections
          .find({ userId: user._id })
          .sort({ createdAt: -1 })
          .toArray();

        // commentCount and loveCount
        const updatedPosts = await Promise.all(
          posts.map(async (post) => {
            const commentCount = await FeedsCommentsCollections.countDocuments({
              postId: post._id,
            });

            const loveCount = post.loveCount || 0;

            return {
              ...post,
              commentCount,
              loveCount,
            };
          }),
        );

        res.send(updatedPosts);
      } catch (err) {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // ------------- GET: for all-post -------------
    app.get("/all-posts", async (req, res) => {
      try {
        const posts = await createPostCollections
          .find()
          .sort({ createdAt: -1 })
          .toArray();

        const updatedPosts = await Promise.all(
          posts.map(async (post) => {
            const commentCount = await FeedsCommentsCollections.countDocuments({
              postId: post._id,
            });

            const loveCount = post.loveCount || 0;

            return {
              ...post,
              commentCount,
              loveCount,
            };
          }),
        );

        res.send(updatedPosts);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // ------------- POST: for create-post -------------
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
              },
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

    /* Feeds Love API's start */
    // ------------- GET: love count + is current user loved this post or not
    app.get("/feeds-love/:loveId", async (req, res) => {
      try {
        const { loveId } = req.params;
        const { userEmail } = req.query;

        const post = await createPostCollections.findOne({
          _id: new ObjectId(loveId),
        });

        if (!post) {
          return res.status(404).send({ message: "post not found" });
        }

        const loveCount = post.loveCount || 0;

        let isLoved = false;
        if (userEmail) {
          const user = await userCollections.findOne({ email: userEmail });

          if (user) {
            const loved = await FeedsLovesCollections.findOne({
              loveId: new ObjectId(loveId),
              userId: user._id,
            });
            isLoved = !!loved;
          }

          res.send({ loveCount, isLoved });
        }
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // ------------- POST: for feeds-love -------------
    app.post("/feeds-love", async (req, res) => {
      try {
        const { loveId, userEmail } = req.body;

        if (!loveId || !userEmail) {
          return res
            .status(400)
            .send({ message: "loveId and userEmail required" });
        }

        // find user
        const user = await userCollections.findOne({ email: userEmail });
        if (!user) {
          return res.status(404).send({ message: "user not found" });
        }

        const loveQuery = {
          loveId: new ObjectId(loveId),
          userId: user._id,
        };

        // if already loved
        const existingLove = await FeedsLovesCollections.findOne(loveQuery);
        if (existingLove) {
          // already loved -> do disLoved
          await FeedsLovesCollections.deleteMany(loveQuery);

          // decrement love count
          await createPostCollections.updateOne(
            { _id: new ObjectId(loveId) },
            { $inc: { loveCount: -1 } },
          );
          return res.send({
            message: "Unloved",
            action: "unlike",
            loveCount: -1,
          });
        } else {
          // create a new love
          const newLove = {
            loveId: new ObjectId(loveId),
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            userImg: user.img || null,
            createdAt: new Date(),
          };

          await FeedsLovesCollections.insertOne(newLove);

          // love count increment
          const updatePost = await createPostCollections.findOneAndUpdate(
            { _id: new ObjectId(loveId) },
            { $inc: { loveCount: 1 } },
            { returnDocument: "after", upsert: false },
          );

          return res.send({
            message: "loved",
            action: "like",
            loveCount: updatePost?.loveCount || 1,
          });
        }
      } catch (err) {
        res.status(500).send({ message: "Internal server error" });
      }
    });
    /* Feeds Love API's end */

    /* Feeds Comment API's start */
    // ------------- GET: for All Comments by Single User by ID -------------
    app.get("/feeds-comments/:postId", async (req, res) => {
      try {
        const { postId } = req.params;

        if (!ObjectId.isValid(postId)) {
          return res.status(400).send({ message: "Invalid postId" });
        }

        const postObjectId = new ObjectId(postId);

        const result = await FeedsCommentsCollections.find({
          postId: postObjectId,
        })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // ------------- POST: for feeds-comments -------------
    app.post("/feeds-comments", async (req, res) => {
      try {
        const { postId, text, userEmail } = req.body;

        if (!postId || !text || !userEmail) {
          return res.status(400).send({
            message: "postId, text, userEmail are required",
          });
        }

        const postObjectId = new ObjectId(postId);

        const user = await userCollections.findOne({ email: userEmail });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        const newComment = {
          postId: postObjectId,
          text,
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          userImg: user.img || null,
          createdAt: new Date(),
        };

        await FeedsCommentsCollections.insertOne(newComment);

        const commentCount = await FeedsCommentsCollections.countDocuments({
          postId: postObjectId,
        });

        res.send({
          message: "Comment added successfully",
          commentCount,
        });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });
    /* Feeds Comment API's end */

    /* Friend Request's API's start */
    // GET: for showing all which user give you friend-request 
    app.get("/friends-request/incoming", async(req, res) => {
      try{
        const { email } = req.query;

        if(!email) {
          res.status(400).send({message: "email is required"});
        }

        const user = await userCollections.findOne({ email });

        if(!user) {
          res.status(400).send({message: "user not define"});
        }

        const result = await FriendRequestCollections.find({
          receiverId: user._id,
          status: "pending"
        }).sort({ createdAt: -1 }).toArray();

        res.send(result);
      }
      catch(err) {
        res.status(500).send({ message: "Internal server error" });
      }
    })

    // GET: for showing status when user frontend page reload it's show the real status
    app.get("/friend-request/status", async(req, res) => {
      try{
        const { senderEmail, receiverEmail } = req.query;

        const sender = await userCollections.findOne({ email: senderEmail });
        const receiver = await userCollections.findOne({email: receiverEmail});

        if (!sender || !receiver) {
          return res.send("none");
        }

        const request = await FriendRequestCollections.findOne({
          $or: [
            { senderId: sender._id, receiverId: receiver._id },
            { senderId: receiver._id, receiverId: sender._id },
          ]
        });

        if (!request) {
          return res.send({ status: "none" });
        }

        res.send({ status: request.status });
      }
      catch(err) {
        res.status(500).send({ message: "Internal server error" });
      }
    });


    // POST: for send friend request
    app.post("/friend-request/send", async (req, res) => {
      try {
        const { senderEmail, receiverEmail } = req.body;

        const sender = await userCollections.findOne({ email: senderEmail });
        const receiver = await userCollections.findOne({email: receiverEmail});

        if (!sender || !receiver) {
          return res.status(404).send("user not found");
        }

        const exist = await FriendRequestCollections.findOne({
          senderId: sender._id,
          receiverId: receiver._id,
        });

        if (exist) {
          return res.send({ message: "Already requested" });
        }

        const request = {
          senderId: sender._id,
          receiverId: receiver._id,
          senderName: sender.name,
          senderEmail: sender.email,
          senderImg: sender.img,
          receiverName: receiver.name,
          receiverEmail: receiver.email,
          receiverImg: receiver.img,
          status: "pending",
          createdAt: new Date(),
        };

        const result = await FriendRequestCollections.insertOne(request);

        res.send({
          message: "Request sent",
          status: "pending",
        });
      } catch (err) {
        res.status(500).send({ message: "Internal server error" });
      }
    });


    // delete: for friend-request cancel
    app.delete("/friend-request/cancel", async(req, res) => {
      try{
        const { senderEmail, receiverEmail } = req.body;

        const sender = await userCollections.findOne({ email: senderEmail });
        const receiver = await userCollections.findOne({email: receiverEmail});

        if (!sender || !receiver) {
          return res.status(404).send({ message: "User not found" });
        }

        const result = await FriendRequestCollections.deleteOne({
          senderId: sender._id,
          receiverId: receiver._id,
          status: "pending",
        });

        if (result.deletedCount === 0) {
          return res.send({ message: "No pending request found" });
        }

        res.send({
          message: "Request cancelled",
          status: "none",
        });
      }
      catch (err) {
        res.status(500).send({ message: "Internal server error" });
      }
    })

    /* Friend Request's API's end */

    /* Edit-Profile API's Start */
    // app.post("/edit-profile", async (req, res) => {
    //   try {
    //   } catch (err) {
    //     res.status(500).send({ message: "Internal Server Error" });
    //   }
    // });
    /* Edit-Profile API's end */

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
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

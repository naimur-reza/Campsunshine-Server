require("dotenv").config();
const express = require("express");
const app = express();
const morgan = require("morgan");
const port = process.env.PORT || 5000;
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// middleware
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2cofc5d.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// collections
const userCollection = client.db("campsunshine").collection("users");
const classCollection = client.db("campsunshine").collection("classes");
const selectCollection = client.db("campsunshine").collection("select");
const paymentCollection = client.db("campsunshine").collection("payment");
async function run() {
  try {
    // generate client secret
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      if (price) {
        const amount = parseFloat(price * 100);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      }
    });

    // users apis #############################

    // post user to db
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      console.log(user, email);
      const query = { email: user.email || email };
      console.log(query);
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    //   get user role from db
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email: email });
      res.send(result);
    });

    // get all users
    app.get("/users", async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.send(result);
    });

    // remove user
    app.delete("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // get instructors
    app.get("/users/status/:role", async (req, res) => {
      const role = req.params.role;
      const result = await userCollection.find({ role: role }).toArray();
      res.send(result);
    });

    // classes apis from here ###################

    // post classes to db
    app.post("/classes", async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    });

    // get all classes
    app.get("/classes", async (req, res) => {
      const result = await classCollection
        .find({})
        .sort({
          status: -1,
        })
        .toArray();
      // const reverse = result.reverse();
      res.send(result);
    });

    // get approved classes
    app.get("/classes/approved", async (req, res) => {
      const result = await classCollection
        .find({ status: "approved" })
        .toArray();
      res.send(result);
    });

    // get popular teacher by enrolled
    app.get("/classes/popular", async (req, res) => {
      const result = await classCollection
        .find({})
        .sort({
          enrolled: -1,
        })
        .limit(7)
        .toArray();
      res.send(result);
    });

    // update class status
    app.patch("/classes/status/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const update = await classCollection.updateOne(query, updateDoc);
      res.send(update);
    });

    // get my classes : instructor
    app.get("/classes/:email", async (req, res) => {
      const email = req.params.email;
      const result = await classCollection.find({ email: email }).toArray();
      res.send(result);
    });

    // update my class
    app.patch("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: req.body,
      };
      const update = await classCollection.updateOne(query, updateDoc);
      res.send(update);
    });

    // post to select collection after selected
    app.post("/classes/select", async (req, res) => {
      const classInfo = req.body;
      const result = await selectCollection.insertOne(classInfo);
      res.send(result);
    });

    // get my selected classes by email
    app.get("/classes/select/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const result = await selectCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    // delete from selected class

    app.delete("/classes/select/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectCollection.deleteOne(query);
      res.send(result);
    });

    // process payment
    app.post("/process-payment", async (req, res) => {
      const paymentInfo = req.body;
      const { classId } = paymentInfo;
      const updateResult = await classCollection.updateOne(
        { _id: new ObjectId(classId) },
        {
          $inc: {
            enrolled: 1,
            seats: -1,
          },
        }
      );
      const result = await paymentCollection.insertOne(paymentInfo);
      res.send(result);
    });

    // get

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Database connected!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is Crying......");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

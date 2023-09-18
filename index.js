const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ehoamog.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


function verifyJwt(req, res, next) {
    console.log(req.headers.authorization);
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden' })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {

        const productsCollection = client.db('PhoneMania2').collection('products')
        await client.connect();
        const bookingCollection = client.db('PhoneMania2').collection('booking');
        const userCollection = client.db('PhoneMania2').collection('user');
        const reportedCollection = client.db('PhoneMania2').collection('reported');
        const paymentCollection = client.db('PhoneMania2').collection('payment');



        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN)
                return res.send({ accessToken: token });
            }
            console.log(user);
            res.status(403).send({ accessToken: 'Unauthorized' });
        })

        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await userCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden' })
            }
            next();
        }


        app.get('/products/:BrandId', async (req, res) => {

            const id = req.params.BrandId;

            const query = { BrandId: id }
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        })

        app.get('/product/:id', async (req, res) => {

            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const products = await productsCollection.findOne(query);
            res.send(products);
        })

        app.get('/products', async (req, res) => {
            const query = {};
            const options = await productsCollection.find(query).toArray();
            res.send(options)
        })

        app.post('/products', async (req, res) => {
            const products = req.body;
            const result = await productsCollection.insertOne(products);
            res.send(result)
        })

        app.put('/products/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    paid: true,
                    availability: "false",
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(filter);
            res.send(result);
        })

        app.get('/bookings/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings)
        })
        app.get('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await bookingCollection.findOne(filter);
            res.send(result);
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        });

        app.delete('/bookings/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await bookingCollection.deleteOne(filter);
            res.send(result);
        })

        app.get('/users', async (req, res) => {

            const query = {};
            const users = await userCollection.find(query).toArray();
            res.send(users);

        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        app.put('/users/admin/:id', verifyJwt, verifyAdmin, async (req, res) => {



            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        app.put('/users/verify/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    verified: 'true'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email }
            const user = await userCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email }
            const user = await userCollection.findOne(query);
            res.send({ isSeller: user?.userType === 'Seller' });
        })

        app.delete('/users/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await userCollection.deleteOne(filter);
            res.send(result);
        })

        app.post('/create-payment-intent', verifyJwt, async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const price = booking.price;
            const p = parseFloat(price.replaceAll(',', '')).toFixed(2);
            console.log(p);

            const amount = p * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ],
            });
            console.log(paymentIntent);
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.post('/payment', verifyJwt, async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment);
            const id = payment.productId;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,

                }
            }

            const updateResult = await bookingCollection.updateOne(filter, updatedDoc);

            res.send(result);

        })


        app.get('/reported', async (req, res) => {
            const query = {};
            const products = await reportedCollection.find(query).toArray();
            res.send(products);
        })
        app.post('/reported', async (req, res) => {
            const products = req.body;
            const result = await reportedCollection.insertOne(products);
            res.send(result)
        })
        app.delete('/reported/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: id };
            const result = await reportedCollection.deleteOne(filter);
            res.send(result);

        })



    } finally {

    }
}
run().catch(console.dir);





app.get('/', async (req, res) => {

    res.send('Phone Mania is running');
})

app.listen(port, () => console.log(`Phone Mania is running on port ${port}`));
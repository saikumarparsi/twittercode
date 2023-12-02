const express = require("express");
const app = express();
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
app.use(express.json());
const jwt = require("jsonwebtoken");
const path = require("path");
const filePath = path.join(__dirname, "twitterClone.db");
let db;
// middle ware func
const auth = async (req, res, next) => {
  const head = req.headers.authorization;
  if (!head) {
    res.status(401).send("Invalid JWT Token");
  } else {
    const token = req.headers.authorization.split(" ")[1];
    await jwt.verify(token, "secretKey", (err, payload) => {
      if (err) {
        res.status(401).send("Invalid JWT Token");
      } else {
        req.body.username = payload.username;
        next();
      }
    });
  }
};
const intializeServerAndDb = async () => {
  try {
    db = await open({
      filename: filePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running");
    });
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};
intializeServerAndDb();
// api 1 register
app.post("/register/", async (req, res) => {
  const { username, password, name, gender } = req.body;
  const checkUserQuery = `select username from user where username = "${username}"`;
  const checkResult = await db.get(checkUserQuery);
  if (checkResult) {
    res.status(400).send("User already exists");
  } else {
    if (password.length < 6) {
      res.status(400).send("Password is too short");
    } else {
      await bcrypt.hash(password, 10, async function (err, hash) {
        if (err) {
          console.log(err);
        } else {
          console.log(hash);
          const createUserQuery = `insert into user (username, password, name, gender) values ("${username}", "${hash}", "${name}", "${gender}")`;
          await db.run(createUserQuery);
          res.status(200).send("User created successfully");
        }
      });
    }
  }
});
// 2 api login
app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const userquery = `select * from user where username = "${username}"`;
  const userResult = await db.all(userquery);
  console.log(userResult.length);
  if (!userResult.length) {
    res.status(400).send("Invalid user");
  } else {
    // console.log(userResult);
    // console.log(userResult.password);
    const bool = await bcrypt.compare(password, userResult[0].password);
    if (!bool) {
      res.status(400).send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "secretKey");
      console.log(jwtToken);
      res.status(200).send({ jwtToken });
    }
  }
});
// get api 3
app.get("/user/tweets/feed/", auth, async (req, res) => {
  const query = `select followed_user.username, tweet.tweet, tweet.date_time as dateTime from user join follower on user.user_id = follower.follower_user_id  join tweet on follower.following_user_id = tweet.user_id join user as followed_user on tweet.user_id = followed_user.user_id where user.username = "${req.body.username}" order by tweet.date_time desc limit 4 offset 0`;
  const result = await db.all(query);
  res.status(200).send(result);
});
// get folliwing usernames api 4
app.get("/user/following/", auth, async (req, res) => {
  const query = `select following_user.username as name from user as follower_user join follower on follower_user.user_id = follower.follower_user_id join user as following_user on follower.following_user_id = following_user.user_id where follower_user.username like "${req.body.username}"`;
  const result = await db.all(query);
  res.status(200).send(result);
});
// user followers api 5
app.get("/user/followers/", auth, async (req, res) => {
  const query = `select following_user.username as name from user as follower_user join follower on follower_user.user_id = follower.following_user_id join user as following_user on follower.follower_user_id = following_user.user_id where follower_user.username like "${req.body.username}"`;
  const result = await db.all(query);
  res.status(200).send(result);
});
// api 6
app.get("/tweets/:tweetId/", auth, async (req, res) => {
  const { tweetId } = req.params;
  const followingQuery = `select * from user join follower on user.user_id = follower.follower_user_id join tweet on following_user_id = tweet.user_id where user.username = "${req.body.username}" and tweet.tweet_id = ${tweetId}`;
  const checkResult = await db.all(followingQuery);
  console.log(checkResult.length);
  if (checkResult.length === 0) {
    res.status(401).send("Invalid Request");
  } else {
    const followingQuery = `select tweet.tweet, count(distinct like.like_id) as likes, count(distinct reply.reply_id) as replies, max(tweet.date_time) as dateTime
     from user
      join 
      follower on user.user_id = follower.follower_user_id 
      join
       tweet on following_user_id = tweet.user_id 
       left join
        reply on tweet.tweet_id = reply.tweet_id 
        left join
         like on tweet.tweet_id = like.tweet_id 
         where
          user.username like "${req.body.username}" and tweet.tweet_id = ${tweetId}`;
    const [finalResult] = await db.all(followingQuery);
    res.status(200).send(finalResult);
  }
});
// api 7 like username
app.get("/tweets/:tweetId/likes/", auth, async (req, res) => {
  const { tweetId } = req.params;
  const followingQuery = `select * from user join follower on user.user_id = follower.follower_user_id join tweet on following_user_id = tweet.user_id where user.username = "${req.body.username}" and tweet.tweet_id = ${tweetId}`;
  const checkResult = await db.all(followingQuery);
  console.log(checkResult.length);
  if (checkResult.length === 0) {
    res.status(401).send("Invalid Request");
  } else {
    const followingQuery = `select user.username from tweet join like on tweet.tweet_id = like.tweet_id join user on like.user_id = user.user_id where tweet.tweet_id = ${tweetId}`;
    const finalResult = await db.all(followingQuery);
    const reqObject = { likes: finalResult.map((each) => each.username) };
    console.log(reqObject);
    res.status(200).send(reqObject);
  }
});
// api 8 replies
app.get("/tweets/:tweetId/replies/", auth, async (req, res) => {
  const { tweetId } = req.params;
  const followingQuery = `select * from user join follower on user.user_id = follower.follower_user_id join tweet on following_user_id = tweet.user_id where user.username = "${req.body.username}" and tweet.tweet_id = ${tweetId}`;
  const checkResult = await db.all(followingQuery);
  console.log(checkResult.length);
  if (checkResult.length === 0) {
    res.status(401).send("Invalid Request");
  } else {
    const followingQuery = `select user.username as name, reply.reply as reply from tweet join reply on tweet.tweet_id = reply.tweet_id join user on reply.user_id = user.user_id where tweet.tweet_id = ${tweetId}`;
    const finalResult = await db.all(followingQuery);
    console.log(finalResult);
    const reqObject = { replies: finalResult };
    console.log(reqObject);
    res.status(200).send(reqObject);
  }
});
// api 9 user tweets
app.get("/user/tweets/", auth, async (req, res) => {
  const query = `select
    tweet.tweet,
    count(distinct like.like_id) as likes,
    count(distinct reply.reply_id) as replies,
    max(tweet.date_time) as dateTime
    from 
    user
    join
    tweet
    on user.user_id = tweet.user_id
    left join
    reply
    on tweet.tweet_id = reply.tweet_id
    left join 
    like
    on tweet.tweet_id = like.tweet_id
    where
    user.username = "${req.body.username}"
    group by
    tweet.tweet_id`;
  const result = await db.all(query);
  res.status(200).send(result);
});
// api 10 user adding tweet fo db
app.post("/user/tweets/", auth, async (req, res) => {
  console.log(req.body);
  const queryForUserid = `select user_id from user where username = "${req.body.username}"`;
  const userId = await db.get(queryForUserid);
  console.log(userId);
  const finalQuery = `insert into tweet (tweet, user_id, date_time) values ("${
    req.body.tweet
  }", "${userId.user_id}", "${new Date()}")`;
  await db.run(finalQuery);
  res.status(200).send("Created a Tweet");
  const check = `select * from tweet where tweet.user_id = 2`;
  console.log(await db.all(check));
});
// api 11 delete
app.delete("/tweets/:tweetId", auth, async (req, res) => {
  const { tweetId } = req.params;
  const query = `select * from user join tweet on user.user_id = tweet.user_id where user.username = "${req.body.username}" and tweet.tweet_id = ${tweetId}`;
  const result = await db.all(query);
  console.log(result);
  if (result.length === 0) {
    res.status(401).send("Invalid Request");
  } else {
    const finalQuery = `delete from tweet where tweet.tweet_id = ${tweetId}`;
    await db.run(finalQuery);
    res.status(200).send("Tweet Removed");
  }
});

module.exports = app;

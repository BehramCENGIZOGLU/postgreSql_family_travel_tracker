import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import { name } from "ejs";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "1234",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

async function usersTable() {
  const users = await db.query(
    "SELECT * FROM users");
  return users.rows;
}

// Bütün kullanıcıların ziyaret ettiği ülkeler alındı.  
async function checkVisisted() {
  const result = await db.query("SELECT country_code FROM visited_countries");
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

// Kullanıcının daha önceden gittiği bir ülkeyi kaydetmemesi için ülke kodu karşılaştırması yapıldı. 
async function findCountry(userId,countryCode){
  const countriesQuery = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1",[userId]);
  const country_code = countriesQuery.rows.find((countries) => countries.country_code.toLowerCase() === countryCode.toLowerCase());
  return country_code;
}

// Daha önceden aynı isimde kullanıcının kayıtlı olup olmadığını kontrol etmek için users tablosu kontrolü yapıldı.
async function findUser(userName){
  const usersQuery=await db.query(
    "SELECT * FROM users WHERE LOWER(name) = $1",[userName.toLowerCase()]);
  return usersQuery;
}

// Kullanıcıların bilgilerinin çekilme işlemi yapıldı.
async function personalVisitedCountry(userId){
  const visitedQuery = await db.query(
    "SELECT u.id, u.name, u.color, vc.country_code FROM users u LEFT JOIN visited_countries vc ON u.id = vc.user_id WHERE u.id = $1",[userId]);
  if(visitedQuery.rows.length){
    const user = {
      id:visitedQuery.rows[0].id,
      name:visitedQuery.rows[0].name,
      color:visitedQuery.rows[0].color,
      countryCode:[]
    };
    visitedQuery.rows.forEach((countries) => {
      if(countries.country_code && countries.country_code.length > 0){
        user.countryCode.push(countries.country_code);
      }
    });
    return user;
  }
  return null;
}

// Kullanıcılar tarafından ziyaret edilen tüm ülkelerin ana sayfada gösterilmesi sağlandı.
app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  const users = await usersTable();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: "teal",
  });
});

app.get("/new",(req,res) => {
  res.render("new.ejs");
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const user = req.body["user"];
  try {
    // Girilen ülkenin kodu alındı.
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );
    if(!result.rows.length){
      return res.redirect("/");
    }
    if(!user || !input){
      return res.redirect("/");
    }
    const data = result.rows[0];
    const countryCode = data.country_code;
    const contryControl = await findCountry(user,countryCode);
    if(!contryControl){
      try {
        // Ziyaret edilen ülkeler tablosuna ziyaret edilen ülke ve ziyaret eden kullanıcı eklendi.
        await db.query(
          "INSERT INTO visited_countries (country_code, user_id) VALUES ($1,$2)",
          [countryCode,user]
        );
        res.redirect("/");
      } catch (err) {
        console.log(err);
      } 
    }else{
      res.redirect("/");
    }
  } catch (err) {
    console.log(err);
  }
});

app.post("/user", async (req, res) => {
  try {
    if(req.body.add === "new"){
      return res.redirect("/new");
    }
    const userId = req.body["user"];
    if(userId){
      // kulllanıcı bilgileri ve ziyaret ettiği ülkelerin gösterilme işlemi yapıldı.
      const userInformation = await personalVisitedCountry(userId);
      res.render("index.ejs",{users:[userInformation], countries:[userInformation.countryCode], color:userInformation.color, total:userInformation.countryCode.length});
    }else{
      res.redirect("/");
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/new", async (req, res) => {
  try {
    const name = req.body["name"];
    const color = req.body["color"];
    if(!name || !color){
      return res.redirect("/new");
    }
    const userControl = await findUser(name);
    if(!userControl.rows.length){
      // Yeni kullanıcı ekleme işlemi yapıldı.
      const addUser = await db.query(
        "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING *",[name, color]
      );
      console.log(addUser.rows[0]);
      res.redirect("/");
    } else{
      res.redirect("/");
    }
  } catch (error) {
    console.log(error);
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

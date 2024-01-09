const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
}

// API 1 LOGIN

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `
    SELECT *
    FROM user
    WHERE username='${username}';`;

  const dbUser = await db.get(selectUserQuery);
  console.log(dbUser);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      console.log({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2 GET STATES

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT state_id AS stateId,
    state_name AS stateName,
    population AS population
    FROM state
    ORDER BY
    state_id;`;

  const dbUser = await db.all(getStatesQuery);
  response.send(dbUser);
});

// API 3 GET STATE BY STATE ID

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `
    SELECT state_id AS stateId,
    state_name AS stateName,
    population AS population
    FROM state
    WHERE 
    state_id=${stateId};`;

  const dbUser = await db.get(getStatesQuery);
  response.send(dbUser);
});

// API 4 POST INTO DISTRICT

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postQuery = `
     INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
     VALUES(
         '${districtName}',
         ${stateId}, 
         ${cases}, 
         ${cured}, 
         ${active}, 
         ${deaths});
     `;
  const dbUser = await db.run(postQuery);
  const distId = dbUser.lastID;
  console.log(distId);
  response.send("District Successfully Added");
});

// API 5 GET DISTRICT BY ID

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistQuery = `
    SELECT
    district_id AS districtId,
    district_name AS districtName,
    state_id AS stateId,
    cases AS cases,
    cured AS cured,
    active AS active,
    deaths AS deaths
    FROM district
    WHERE district_id=${districtId};`;

    const dbUser = await db.get(getDistQuery);
    response.send(dbUser);
  }
);

// API 6 DELETE DISTRICT BY ID

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const deleteDist = `
    DELETE 
    FROM district
    WHERE district_id=${districtId};`;
    const dbUser = await db.run(deleteDist);
    response.send("District Removed");
  }
);

//API 7 UPDATE DISTRICT DETAILS

app.put("/districts/:districtId/", async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const { districtId } = request.params;

  const updateDistrict = `
    UPDATE district
    SET
    district_name='${districtName}',
    state_id =${stateId};
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=$${deaths}
    WHERE district_id=${districtId};`;

  const dbUser = await db.run(updateDistrict);
  response.send("District Details Updated");
});

// API 8 GET TOTAL CASES BY BASED ON STATE ID

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getCase = `
    SELECT SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id= ${stateId};`;

    const dbUser = await db.get(getCase);
    response.send(dbUser);
  }
);

module.exports = app;

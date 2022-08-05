const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const app = express();
app.use(express.json());
let database = null;

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDBAndServer = async () => {
  try {
    database = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB ERROR: ${error.message}`);
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
    jwt.verify(jwtToken, "qwertyuiop", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

//

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "qwertyuiop");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// GET states
app.get("/states/", authenticateToken, async (request, response) => {
  const statesQuery = `SELECT 
        state_id AS stateId,
        state_name AS stateName,
        population
  FROM state;`;
  const statesDetails = await database.all(statesQuery);
  response.send(statesDetails);
});

// GET state
app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `SELECT 
        state_id AS stateId,
        state_name AS stateName,
        population
  FROM state
  WHERE state_id = ${stateId};`;
  const stateDetails = await database.get(stateQuery);
  response.send(stateDetails);
});
// GET District
app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `SELECT 
        district_id AS districtId,
        district_name AS districtName,
        state_id AS stateId, 
        cases, cured, active, deaths
  FROM district
  WHERE district_id = ${districtId};`;
    const districtDetails = await database.get(districtQuery);
    response.send(districtDetails);
  }
);
//GET stats
app.get(
  "/states/:stateId/stats",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const stateQuery = `SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
  FROM state NATURAL JOIN district
  WHERE state_id = ${stateId};`;
    const stateDetails = await database.get(stateQuery);
    response.send(stateDetails);
  }
);

// POST district
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `INSERT INTO
      district(district_name, state_id, cases, cured, active, deaths)
    VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  const districtDetails = await database.run(postDistrictQuery);
  response.send("District Successfully Added");
});

// DELETE district
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district
  WHERE district_id = ${districtId};`;
    const districtDetails = await database.run(deleteQuery);
    response.send("District Removed");
  }
);

// Update District
app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `UPDATE district
    SET
        district_name = '${districtName}',
        state_id = ${stateId}, 
        cases = ${cases}, 
        cured = ${cured}, 
        active = ${active}, 
        deaths = ${deaths}
    WHERE district_id = ${districtId};`;
    const districtDetails = await database.run(updateQuery);
    response.send("District Details Updated");
  }
);

module.exports = app;

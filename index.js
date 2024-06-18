import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import dayjs from "dayjs";
dotenv.config({});
const app = express();

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);

const calendar = google.calendar({
  version: "v3",
  auth: process.env.API_KEY,
});
app.get("/google", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });
  res.redirect(authUrl);
});

app.get("/google/redirect", async (req, res) => {
  const code = req.query.code;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  res.send({
    message: "user login successully",
  });
});
app.get("/create", async (req, res) => {
  await calendar.events.insert({
    calendarId: "primary",

    auth: oauth2Client,

    requestBody: {
      summary: "This is test meeting in google calender 2 and have fun",
      description: "testing for crm dhqdas",
      start: {
        dateTime: dayjs(new Date()).add(1, "day").toISOString(),
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: dayjs(new Date()).add(1, "day").add(1, "hour").toISOString(),
      },
      conferenceData: {
        createRequest: {
          requestId: new Date().toISOString(),
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      },
      attendees: [
        {
          email: "hitesh.solanki@26ideas.com",
        },
      ],
    },
    conferenceDataVersion: 1,
  });
  res.send("done");
});

app.listen(4000, () => {
  console.log("server is starting");
});

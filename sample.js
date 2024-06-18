import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import dayjs from "dayjs";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(bodyParser.json()); // Middleware to parse JSON bodies

// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);

// In-memory token storage (replace with a persistent store in production)
const userTokens = {};

// Google Calendar API setup
const calendar = google.calendar({
  version: "v3",
  auth: oauth2Client,
});

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use other email service providers
  auth: {
    user: process.env.EMAIL, // Your email address
    pass: process.env.EMAIL_PASSWORD, // Your email password or app-specific password
  },
});

// Route to initiate Google OAuth login
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

// OAuth2 callback route to handle Google OAuth response
app.get("/google/redirect", async (req, res) => {
  const code = req.query.code;

  try {
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user's profile information
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Store tokens in-memory using user's ID as the key
    userTokens[userInfo.id] = tokens;

    // Respond with user info
    res.send({
      message: "User login successful",
      userId: userInfo.id,
      userName: userInfo.name,
      userEmail: userInfo.email,
    });
  } catch (error) {
    console.error("Error during OAuth process:", error);
    res.status(500).send("Authentication failed");
  }
});

// Route to create a new Google Calendar event and send an email
app.post("/create", async (req, res) => {
  const { userId, summary, description, startTime, endTime, attendees } = req.body;

  // Retrieve the user's tokens from storage
  const userTokensData = userTokens[userId];
  if (!userTokensData) {
    return res.status(401).send("User not authenticated");
  }

  // Set the credentials for the OAuth2 client
  oauth2Client.setCredentials(userTokensData);

  try {
    // Create a new calendar event
    const event = await calendar.events.insert({
      calendarId: "primary",
      auth: oauth2Client,
      requestBody: {
        summary,
        description,
        start: {
          dateTime: new Date(startTime).toISOString(),
          timeZone: "Asia/Kolkata",
        },
        end: {
          dateTime: new Date(endTime).toISOString(),
          timeZone: "Asia/Kolkata",
        },
        conferenceData: {
          createRequest: {
            requestId: new Date().toISOString(),
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        },
        attendees: attendees.map(email => ({ email })), // Format attendees
      },
      conferenceDataVersion: 1,
    });

    // Send email with meeting details to all attendees
    const emailPromises = attendees.map(email => {
      return transporter.sendMail({
        from: process.env.EMAIL, // Your email address
        to: email, // Attendee's email address
        subject: `Invitation: ${summary}`,
        html: `
          <p>You have been invited to a meeting:</p>
          <p><strong>Title:</strong> ${summary}</p>
          <p><strong>Description:</strong> ${description}</p>
          <p><strong>Start Time:</strong> ${new Date(startTime).toLocaleString()}</p>
          <p><strong>End Time:</strong> ${new Date(endTime).toLocaleString()}</p>
          <p><strong>Meeting Link:</strong> <a href="${event.data.hangoutLink}">${event.data.hangoutLink}</a></p>
        `,
      });
    });

    // Await all email promises
    await Promise.all(emailPromises);

    // Respond with the event details
    res.send({
      message: "Event created and email sent successfully",
      eventLink: event.data.hangoutLink, // Link to Google Meet
    });
  } catch (error) {
    console.error("Error creating calendar event or sending email:", error);
    res.status(500).send("Failed to create event or send email");
  }
});

// Start the Express server
app.listen(4000, () => {
  console.log("Server is running on http://localhost:4000");
});

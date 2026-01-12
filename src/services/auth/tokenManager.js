import axios from "axios";
import base64 from "base-64";
import fs from "fs";
import path from "path";
import qs from "qs";
import { logger } from "../../index.js";

const TOKEN_PATH = path.join(process.cwd(), "gong-token.json");

// Refresh if less than 6 days left
// const REFRESH_THRESHOLD_SECONDS = 525000; // 6 days
const REFRESH_THRESHOLD_SECONDS = 5.5 * 24 * 60 * 60; // 475,200 seconds
const REFRESH_BEFORE_EXPIRY_SECONDS = 6 * 60 * 60; // 6 hours

async function getGongAccessToken() {
  try {
    const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    const now = Math.floor(Date.now() / 1000);

    if (
      typeof tokenData.expires_at === "number" &&
      tokenData.expires_at - now > REFRESH_BEFORE_EXPIRY_SECONDS
    ) {
      return tokenData.access_token;
    }

    // if (
    //   typeof tokenData.expires_at === "number" &&
    //   tokenData.expires_at > now + REFRESH_THRESHOLD_SECONDS
    // ) {
    //   return tokenData.access_token;
    // }

    return await refreshGongToken(tokenData.refresh_token);
  } catch (_) {
    // No file found → first refresh
    return await refreshGongToken(process.env.GONG_REFRESH_TOKEN);
  }
}

async function refreshGongToken(currentRefreshToken) {
  const clientId = process.env.GONG_CLIENT_ID;
  const clientSecret = process.env.GONG_CLIENT_SECRET;

  const basicAuth = base64.encode(`${clientId}:${clientSecret}`);

  const url = `https://app.gong.io/oauth2/generate-customer-token?grant_type=refresh_token&refresh_token=${currentRefreshToken}`;

  const headers = {
    Authorization: `Basic ${basicAuth}`,
    "Content-Type": "application/json",
  };

  const { data } = await axios.post(url, null, { headers });

  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

  fs.writeFileSync(
    TOKEN_PATH,
    JSON.stringify(
      {
        access_token: data.access_token,
        refresh_token: data.refresh_token, // 🔥 New refresh stored
        api_base_url: data.api_base_url_for_customer,
        expires_at: expiresAt,
      },
      null,
      2
    )
  );

  return data.access_token;
}

let accessToken = null;
let expiresAt = 0;
let refreshPromise = null;

const EXPIRY_BUFFER_MS = 2 * 60 * 1000; // refresh 2 minutes early

async function getIntermediaAccessToken() {
  try {
    const url = "https://login.intermedia.net/user/connect/token";

    const data = qs.stringify({
      grant_type: "client_credentials",
      client_id: process.env.INTERMEDIA_CLIENT_ID,
      client_secret: process.env.INTERMEDIA_SECRET_KEY,
    });

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const response = await axios.post(url, data, { headers });

    logger.info("✔️ Intermedia token generated successfully");
    return {
      accessToken: response.data.access_token,
      expires_in: response.data.expires_in,
    };

    // return response.data;
  } catch (error) {
    console.error(
      "❌ Failed to get Intermedia token:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function fetchIntermediaToken() {
  try {
    const isTokenValid =
      accessToken && Date.now() < expiresAt - EXPIRY_BUFFER_MS;

    if (isTokenValid) {
      return accessToken;
    }

    // Prevent multiple refresh calls
    if (!refreshPromise) {
      refreshPromise = getIntermediaAccessToken()
        .then(({ accessToken: newToken, expires_in }) => {
          accessToken = newToken;
          expiresAt = Date.now() + expires_in * 1000;
          return accessToken;
        })
        .catch((err) => {
          accessToken = null;
          expiresAt = 0;
          throw err;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    return refreshPromise;
  } catch (error) {
    logger.error("Error fetching Intermedia token:", error);
  }
}

export { getGongAccessToken, getIntermediaAccessToken, fetchIntermediaToken };

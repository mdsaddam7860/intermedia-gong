import { logger, gongAxios, getGongAccessToken } from "../index.js";
import axios from "axios";
import fs from "fs";
import FormData from "form-data";

/**
 * Create Gong Call Record
 * @param {string} accessToken - Valid Gong access token
 * @param {object} callBody - Request body for Gong create call API
 */
async function createGongCall(callBody) {
  try {
    const token = await getGongAccessToken();
    const response = await gongAxios(token).post("/v2/calls", callBody);

    logger.info("✔️ Gong call created successfully!");
    return response.data;
  } catch (error) {
    console.error(
      "❌ Gong call creation failed:",
      error.response?.data || error
    );
    return null;
  }
}

async function getGongUsers() {
  try {
    // const url = "https://api.gong.io/v2/users";
    // const token = await getGongAccessToken();

    const response = await gongAxios().get("/v2/users");

    logger.info(
      `✔️ Gong users fetched successfully! : ${response.data.users.length}`
    );
    return response.data.users || [];
  } catch (error) {
    console.error(
      "❌ Failed to fetch Gong users:",
      error.response?.data || error.message
    );
    return [];
  }
}

async function getGongUser(userId, email) {
  try {
    const response = await gongAxios().get(`/v2/users/${userId}`, {
      params: {
        emailAddress: email,
      },
    });

    return response.data || null; // user
  } catch (error) {
    console.error(
      "❌ Error fetching Gong user:",
      error.response?.data || error.message
    );
    return null;
  }
}

// async function uploadMediaToGong(callId, mediaFilePath) {
//   try {
//     const form = new FormData();

//     // IMPORTANT: field name must be EXACTLY "mediaFile"
//     form.append("mediaFile", fs.createReadStream(mediaFilePath));

//     const response = await axios.put(
//       `https://api.gong.io/v2/calls/${callId}/media`,
//       form,
//       {
//         headers: {
//           Authorization: `Basic ${process.env.GONG_BASIC_TOKEN}`,
//           ...form.getHeaders(), // 🚨 REQUIRED
//         },
//         maxBodyLength: Infinity,
//         maxContentLength: Infinity,
//       }
//     );

//     logger.info(
//       `Recording uploaded to Gong: ${JSON.stringify(response.data, null, 2)}`
//     );

//     return response.data;
//   } catch (error) {
//     logger.error(
//       "Error uploading media to Gong:",
//       error.response?.data || error.message
//     );
//     return null;
//   }
// }

async function uploadMediaToGong(callId, mediaFilePath) {
  try {
    const form = new FormData();

    // IMPORTANT: field name must be EXACTLY "mediaFile"
    form.append("mediaFile", fs.createReadStream(mediaFilePath));

    const response = await axios.put(
      `https://api.gong.io/v2/calls/${callId}/media`,
      form,
      {
        headers: {
          Authorization: `Basic ${process.env.GONG_BASIC_TOKEN}`,
          ...form.getHeaders(), // 🚨 REQUIRED
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    logger.info(
      `Recording uploaded to Gong: ${JSON.stringify(response.data, null, 2)}`
    );

    return response.data;
  } catch (error) {
    logger.error(
      "Error uploading media to Gong:",
      error.response?.data || error.message
    );
    return null;
  }
}
export { createGongCall, getGongUsers, getGongUser, uploadMediaToGong };

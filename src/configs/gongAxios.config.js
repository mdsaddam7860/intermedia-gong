import axios from "axios";
import fs from "fs";
import path from "path";
const TOKEN_PATH = path.join(process.cwd(), "gong-token.json");

function gongAxios(token) {
  if (token) {
    const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    return axios.create({
      baseURL: tokenData.api_base_url,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  }

  // if token is not present then use basic token
  return axios.create({
    baseURL: "https://api.gong.io",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${process.env.GONG_BASIC_TOKEN}`,
    },
  });
}

function intermediaAxios(token) {
  return axios.create({
    baseURL: "https://api.intermedia.net/voice/v2/accounts/_me/",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

export { gongAxios, intermediaAxios };

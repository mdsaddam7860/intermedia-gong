import { logger } from "../index.js";

/**
 *
      "whenCreated": "2025-12-22T22:24:06+00:00",
      "direction": "incoming",
      "id": 13027816,
      "fileName": "1144/50648/cr_2025_Dec_22_14_24_06_207670.mp3",
      "duration": 33,
      "caller": {
        "phoneNumber": "+19312158581",
        "displayName": "WIRELESS CALLER"
      },} recording 



      {
    "clientUniqueId": "60eea7fd-528b-4480-990f-e5e1ce51e8ba",
    "actualStart": "2025-03-20T10:30:00Z",
    "direction": "Inbound",
    "primaryUser": "904917957461791869",
    "parties": [
  {
    "userId": "904917957461791869",
    "type": "External"
  }
],
    "downloadMediaUrl": "https://1144/50648/cr_2025_Dec_19_14_18_01_174812.mp3"
  }
 
 */
const gongUserId = "904917957461791869";
// function mapIntermediaCallToGongPayload(recording, user, gongId) {
//   if (!recording) {
//     logger.warn("Missing required data for Gong call mapping");
//     return null;
//   }

//   const payload = {
//     // Gong requires a UNIQUE id per call
//     clientUniqueId: `intermedia-${recording.id}`,

//     // Intermedia creation time → Gong start time
//     actualStart: new Date(recording.whenCreated).toISOString(),

//     // Normalize direction
//     direction:
//       recording.direction?.toLowerCase() === "incoming"
//         ? "Inbound"
//         : "Outbound",

//     primaryUser: gongId,

//     parties: [
//       {
//         // External caller (customer)
//         phoneNumber: recording.caller?.phoneNumber,
//         name: recording.caller?.displayName,
//         type: "External",
//       },
//       {
//         // Internal Gong user (agent)
//         userId: gongId,
//         type: "Internal",
//       },
//     ],
//     // parties: [
//     //   {
//     //     userId: gongUserId,
//     //     type: "External",
//     //   },
//     // ],

//     // Gong must be able to download the media
//     downloadMediaUrl: `https://${recording.fileName}`,
//   };

//   return payload;
// }

function mapIntermediaCallToGongPayload(recording, user, gongId) {
  if (!recording || !gongId) {
    logger.warn("Missing recording or Gong user ID");
    return null;
  }

  return {
    clientUniqueId: `intermedia-${recording.id}`,

    actualStart: new Date(recording.whenCreated).toISOString(),

    direction:
      recording.direction?.toLowerCase() === "incoming"
        ? "Inbound"
        : "Outbound",

    primaryUser: gongId,

    title: `Intermedia Call - ${recording.direction}`,

    parties: [
      { userId: gongId },
      ...(recording.caller?.phoneNumber
        ? [
            {
              phoneNumber: recording.caller.phoneNumber,
              name: recording.caller.displayName,
            },
          ]
        : []),
    ],
  };
}

function normalizeNameKey(name = "") {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

const gongUserIdMap = {
  drewtorgerson: "652241203248768780",
  tannerrice: "904917957461791869",
  tysonlanglie: "1056138687571096789",
  coreysammons: "1485263572787679454",
  jamesdyrdahl: "1577597221867805776",
  dickmatchinsky: "2047311875191222835",
  chriswessel: "2878040947656238702",
  haydenjohnston: "2924403568883428721",
  erikgullickson: "3913958919109221204",
  lukesandwick: "4357757725766283847",
  toddwestlund: "4423835907240316110",
  bradklinkner: "4766927245764613119",
  beauidalski: "5479950274081623826",
  kyledonlea: "5493464345222216438",
  eriklarum: "5516216347423336748",
  shanematchinsky: "5731927622420624759",
  caseyrudolf: "5925663388557370578",
  chriscurry: "5966593620605387389",
  austinlarson: "6419104268163360761",
  jeremyjohnson: "6592174764819505494",
  chrisyerkes: "6911873291640197311",
  joesanden: "7009761441972976950",
  randyanderson: "7520619343977072272",
  coryclark: "7802321460473048615",
  marcfritz: "8514158382024116076",
  billklitzke: "9135909148067142168",
};

function buildUserIdMap(name = " ") {
  const key = normalizeNameKey(name);
  return gongUserIdMap[key];
}

export { mapIntermediaCallToGongPayload, buildUserIdMap };
